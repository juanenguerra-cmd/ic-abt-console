import { FormTemplate } from '../types/forms';

const DEFAULT_RESIDENT_FORMS: FormTemplate[] = [
  {
    id: 'consent-treatment',
    name: 'Consent for Treatment',
    description: 'General consent form for admission and treatment.',
    category: 'resident',
    icon: 'file-text',
    templateContent: `<div><h1>Consent for Treatment</h1><p>Resident: {{residentName}}</p></div>`,
  },
  {
    id: 'hipaa-ack',
    name: 'HIPAA Notice Acknowledgement',
    description: 'Acknowledgement of receipt of privacy practices.',
    category: 'resident',
    icon: 'file-text',
    templateContent: `<div><h1>HIPAA Notice Acknowledgement</h1><p>Resident: {{residentName}}</p></div>`,
  },
  {
    id: 'financial-responsibility',
    name: 'Financial Responsibility Agreement',
    description: 'Resident and responsible party financial agreement.',
    category: 'resident',
    icon: 'file-text',
    templateContent: `<div><h1>Financial Responsibility Agreement</h1><p>Resident: {{residentName}}</p></div>`,
  },
  {
    id: 'pain-medication-education',
    name: 'Pain Medications: Understanding the Risks and Benefits',
    description: 'Educational guide about pain medication risks, benefits, and management options.',
    category: 'resident',
    icon: 'pill',
    templateContent: `<article class="form-page pain-medication-form">
  <p class="pain-resident-line">Resident name: {{residentName}}&nbsp;&nbsp; Unit: {{unit}}&nbsp;&nbsp; Room: {{room}}</p>
  <h1 class="pain-title">Pain Medications: Understanding the Risks and Benefits</h1>
  <h2 class="pain-subtitle">An Educational Guide for Nursing Home Residents and Families</h2>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-success">✅</span>Why Pain Management Is Important</h3>
  <p class="body-copy">Pain affects your ability to move, rest, and enjoy daily life. Managing pain can improve comfort, function, and quality of life.</p>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-warning">🔶</span>Common Pain Medications</h3>
  <table>
    <thead>
      <tr><th>Type</th><th>Examples</th><th>Purpose</th></tr>
    </thead>
    <tbody>
      <tr><td>Acetaminophen</td><td>Tylenol</td><td>Mild pain, fever</td></tr>
      <tr><td>NSAIDs</td><td>Ibuprofen, Naproxen</td><td>Arthritis, inflammation</td></tr>
      <tr><td>Opioids</td><td>Oxycodone, Morphine</td><td>Moderate to severe pain</td></tr>
      <tr><td>Adjuvants</td><td>Gabapentin,<br/>Amitriptyline</td><td>Nerve or chronic pain</td></tr>
    </tbody>
  </table>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-star">⭐</span>Benefits of Pain Medication</h3>
  <ul class="list">
    <li>Improves comfort and sleep</li>
    <li>Enhances mobility and activity</li>
    <li>Supports mood and emotional well-being</li>
    <li>Helps with healing and participation in therapy</li>
  </ul>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-warning">🔶</span>Potential Risks &amp; Side Effects</h3>
  <p class="body-copy"><strong>All Medications:</strong></p>
  <ul class="list">
    <li>Drowsiness, dizziness, constipation</li>
    <li>Nausea or upset stomach</li>
    <li>Dry mouth or confusion</li>
  </ul>
  <p class="body-copy"><strong>Opioids Specific:</strong></p>
  <ul class="list">
    <li>Risk of dependency or addiction</li>
    <li>Breathing problems (in overdose)</li>
    <li>Interactions with sedatives or alcohol</li>
  </ul>
  <p class="body-copy"><strong>NSAIDs Specific:</strong></p>
  <ul class="list">
    <li>Stomach bleeding or ulcers</li>
    <li>Kidney problems</li>
    <li>Increased blood pressure or heart risks</li>
  </ul>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-info">🔵</span>What You Can Do</h3>
  <ul class="list">
    <li>Tell staff if you're in pain or have side effects</li>
    <li>Take medication as directed</li>
    <li>Ask questions before starting or changing any medications</li>
    <li>Participate in non-drug therapy options</li>
  </ul>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-leaf">🌿</span>Non-Medication Options</h3>
  <ul class="list">
    <li>Heat/cold therapy</li>
    <li>Physical therapy/exercise</li>
    <li>Massage or repositioning</li>
    <li>Relaxation/music therapy</li>
  </ul>

  <hr class="form-divider"/>
  <h3 class="section-title"><span class="icon icon-info">🔵</span>Our Commitment</h3>
  <p class="body-copy">We will monitor your pain, adjust treatments, and work with you and your family to keep you safe, informed, and comfortable.</p>

  <p class="pain-footer">Provided to Resident/Representative: _________________________________&nbsp;&nbsp; By: __________</p>
</article>`,
  },
  {
    id: 'vaccine-consent-pneumo-flu',
    name: 'Pneumococcal & Influenza Vaccine Consent',
    description: 'Combined consent/refusal form for pneumococcal and influenza vaccinations.',
    category: 'resident',
    icon: 'syringe',
    templateContent: `<article class="form-page vaccine-consent-form">
  <p class="vax-header">{{facilityName}}</p>
  <p class="vax-header">CONSENT FOR PNEUMOCOCCAL/INFLUENZA VACCINE ADMINISTRATION</p>

  <p class="resident-name-row">Resident's Name: {{residentName}}</p>

  <h2 class="vax-title">PNEUMOCOCCAL VACCINE</h2>

  <h3 class="underlined-heading">Pneumococcal Consent</h3>
  <p class="consent-paragraph">I have read, or had explained to me, the Vaccine Information Statements about pneumococcal vaccination. I understand the benefits and risks of the vaccination as described. The CDC recommends PCV15, PCV20, or PCV21 for adults 50 years and older who have not had a pneumococcal vaccine or are unsure of their vaccine history. If PCV15 was received, PPSV23 is given in 1 year and immunization is complete. If PCV20 or PCV21 is administered, no additional vaccination is recommended.</p>

  <h3 class="underlined-heading">Pneumococcal Acceptance</h3>
  <p class="consent-paragraph">I request that the pneumococcal vaccination as explained above be given to me (or the person named above for whom I authorized to make this request).</p>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Recipient (or Designated representative)</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>

  <h3 class="underlined-heading">Pneumococcal Refusal</h3>
  <p class="consent-paragraph">I have decided to decline that the pneumococcal vaccination as explained above be given to me (or the person named above for whom I am authorized to make this request).</p>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Recipient (or Designated representative)</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>

  <p class="asterisk-divider">***********************************************************************</p>

  <h2 class="vax-title">INFLUENZA VACCINE</h2>

  <h3 class="underlined-heading">Influenza Consent</h3>
  <p class="consent-paragraph">I have read, or had explained to me, the Vaccine Information Statement about influenza vaccination. I understand the benefits and risks of the vaccination as described. I request that the influenza vaccination be given to me (or the person named above for whom I am authorized to make this request).</p>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Recipient (or Designated representative)</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>

  <h3 class="underlined-heading">Influenza Refusal</h3>
  <p class="consent-paragraph">I have decided to decline that the influenza vaccination as explained above be given to me (or the person named above for whom I am authorized to make this request).</p>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Recipient (or Designated representative)</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>

  <p class="vax-footer">This authorization is in effect until revocation by the above signed party. This consent will be used annually during review of vaccinations and to administer influenza vaccine yearly.</p>
</article>`,
  },

];

export function useFormTemplates() {
  return {
    residentForms: DEFAULT_RESIDENT_FORMS,
  };
}
