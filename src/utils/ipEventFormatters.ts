import { IPEvent, IPEventIndication } from '../domain/models';

/**
 * Shared formatting utilities for IP event display across all views and exports.
 *
 * Separator conventions:
 *  - Comma (`, `)  — joins multiple short indication labels  e.g. "Wound, MRSA"
 *  - Slash (` / `) — joins wound-site + wound-type parts     e.g. "Left Thigh / Squamous Cell Carcinoma"
 *  - Semicolon (`; `) — joins multiple full indication strings e.g. "Left Thigh / SCC; MDRO: MRSA"
 */

/**
 * Returns a short label for a single EBP indication (used in the Precaution column).
 * e.g. "Wound", "MRSA", "Indwelling"
 */
const formatIndicationShort = (ind: IPEventIndication): string => {
  if (ind.category === 'Catheter') {
    const ct = ind.catheterType === 'Other' ? (ind.catheterOtherText || 'Other') : ind.catheterType;
    return ct || 'Catheter';
  }
  if (ind.category === 'MDRO') {
    const mdroText = ind.mdroType === 'Other' ? (ind.mdroOtherText || 'Other MDRO') : ind.mdroType;
    return mdroText || 'MDRO';
  }
  if (ind.category === 'Wound') return 'Wound';
  return ind.category;
};

/**
 * Returns a detailed label for a single EBP indication (used in the Infected Source column).
 * - Wound: "Left Thigh / Squamous Cell Carcinoma"
 * - MDRO: "MDRO: MRSA (Indwelling)"
 * - Catheter: "Catheter: Indwelling"
 */
const formatIndicationFull = (ind: IPEventIndication): string => {
  if (ind.category === 'Wound') {
    const parts = [ind.woundSite, ind.woundType].filter(Boolean).join(' / ');
    return parts || 'N/A';
  }
  if (ind.category === 'MDRO') {
    const mdroText = ind.mdroType === 'Other' ? (ind.mdroOtherText || 'Other MDRO') : (ind.mdroType || 'N/A');
    const catheter = ind.catheterType === 'Other' ? (ind.catheterOtherText || 'Other') : ind.catheterType;
    return catheter ? `MDRO: ${mdroText} (${catheter})` : `MDRO: ${mdroText}`;
  }
  if (ind.category === 'Catheter') {
    const ct = ind.catheterType === 'Other' ? (ind.catheterOtherText || 'Other') : ind.catheterType;
    return `Catheter: ${ct || 'N/A'}`;
  }
  return ind.category;
};

/**
 * Formats the "Precaution/Isolation" column value.
 * - Isolation: "Isolation / [Type]"
 * - EBP: "EBP/ [Indication Details]" (e.g. "EBP/ Wound")
 */
export const getPrecautionLabel = (ip: IPEvent): string => {
  if (ip.ebp) {
    const details = ip.indications && ip.indications.length > 0
      ? ip.indications.map(formatIndicationShort).join(', ')
      : (ip.isolationType || 'N/A');
    return `EBP/ ${details}`;
  }
  return `Isolation / ${ip.isolationType || 'N/A'}`;
};

/**
 * Formats the "Infected Source" column value.
 * - Isolation: Infection Category or Organism
 * - EBP: Full breakdown of all indications
 *   e.g. "Left Thigh / Squamous Cell Carcinoma; MRSA (Indwelling)"
 */
export const getInfectionSourceLabel = (ip: IPEvent): string => {
  if (ip.ebp) {
    if (!ip.indications || ip.indications.length === 0) {
      return ip.sourceOfInfection || ip.organism || 'N/A';
    }
    return ip.indications.map(formatIndicationFull).join('; ') || 'N/A';
  }
  return ip.infectionCategory || ip.organism || ip.sourceOfInfection || 'N/A';
};
