import { FormTemplate } from '../types/forms';

const DEFAULT_RESIDENT_FORMS: FormTemplate[] = [
  {
    id: 'consent-treatment',
    name: 'Consent for Treatment',
    description: 'General consent form for admission and treatment.',
    category: 'resident',
    icon: 'file-text',
    templateContent: `<article class="form-page consent-treatment-form">
  <p class="form-header">{{facilityName}}</p>
  <p class="form-header">CONSENT FOR ADMISSION AND TREATMENT</p>

  <p class="resident-name-row">Resident's Name: {{residentName}}&nbsp;&nbsp; Room: {{room}}&nbsp;&nbsp; Unit: {{unit}}&nbsp;&nbsp; Date of Admission: {{date}}</p>

  <h2 class="form-title">GENERAL CONSENT FOR TREATMENT</h2>

  <h3 class="underlined-heading">Authorization for Treatment</h3>
  <p class="consent-paragraph">I, the undersigned, hereby voluntarily consent to and authorize the physicians, nurses, and other healthcare staff of {{facilityName}} to administer such medical, nursing, and other health care services, treatments, and procedures as may be deemed necessary or advisable in the treatment and care of the above-named resident. This includes routine diagnostic procedures, therapeutic services, and nursing care.</p>

  <h3 class="underlined-heading">Emergency Treatment</h3>
  <p class="consent-paragraph">In the event of an emergency, I authorize the facility to take all necessary steps to protect the health and safety of the resident, including transfer to a hospital for emergency medical treatment, prior to obtaining additional consent.</p>

  <h3 class="underlined-heading">Release of Information</h3>
  <p class="consent-paragraph">I authorize {{facilityName}} to release medical information as required for treatment, payment, and healthcare operations, and to comply with applicable state and federal laws, including reporting obligations.</p>

  <h3 class="underlined-heading">Resident/Representative Consent</h3>
  <p class="consent-paragraph">By signing below, I confirm that I have read, or had read to me, the above statements. I understand and agree to the terms stated. I acknowledge that I have had the opportunity to ask questions and that they have been answered to my satisfaction.</p>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Resident or Authorized Representative</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>

  <h3 class="underlined-heading">Relationship to Resident (if signed by representative)</h3>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Relationship / Authority (e.g., Power of Attorney, Guardian)</span>
      <span class="signature-caption-date">Print Name</span>
    </div>
  </div>

  <p class="form-footer">Witnessed by: _________________________________ &nbsp;&nbsp; Title: _________________ &nbsp;&nbsp; Date: __________</p>
</article>`,
  },
  {
    id: 'hipaa-ack',
    name: 'HIPAA Notice Acknowledgement',
    description: 'Acknowledgement of receipt of privacy practices.',
    category: 'resident',
    icon: 'file-text',
    templateContent: `<article class="form-page hipaa-ack-form">
  <p class="form-header">{{facilityName}}</p>
  <p class="form-header">ACKNOWLEDGEMENT OF RECEIPT OF NOTICE OF PRIVACY PRACTICES</p>

  <p class="resident-name-row">Resident's Name: {{residentName}}&nbsp;&nbsp; Date: {{date}}</p>

  <h2 class="form-title">HIPAA NOTICE ACKNOWLEDGEMENT</h2>

  <h3 class="underlined-heading">Your Privacy Rights</h3>
  <p class="consent-paragraph">{{facilityName}} is required by the Health Insurance Portability and Accountability Act (HIPAA) to maintain the privacy of your protected health information (PHI), to provide you with notice of our legal duties and privacy practices, and to abide by the terms of our Notice of Privacy Practices.</p>

  <h3 class="underlined-heading">How We May Use and Disclose Your Health Information</h3>
  <p class="consent-paragraph">We may use and disclose your protected health information for the following purposes without your written authorization:</p>
  <ul class="list">
    <li><strong>Treatment:</strong> To provide, coordinate, or manage your health care and related services.</li>
    <li><strong>Payment:</strong> To bill and collect payment for services rendered, including submission to Medicare, Medicaid, or other insurers.</li>
    <li><strong>Healthcare Operations:</strong> For quality assessment, staff training, compliance reviews, and other operational activities.</li>
    <li><strong>As Required by Law:</strong> To comply with state and federal reporting requirements, public health activities, or court orders.</li>
  </ul>

  <h3 class="underlined-heading">Your Rights Regarding Your Health Information</h3>
  <ul class="list">
    <li>Request restrictions on certain uses and disclosures of your health information.</li>
    <li>Request to receive communications by alternative means or at alternative locations.</li>
    <li>Inspect and copy your health information as provided by law.</li>
    <li>Request an amendment to your health information.</li>
    <li>Receive an accounting of certain disclosures of your health information.</li>
    <li>Receive a paper copy of our Notice of Privacy Practices upon request.</li>
  </ul>

  <h3 class="underlined-heading">Acknowledgement of Receipt</h3>
  <p class="consent-paragraph">By signing below, I acknowledge that I have received a copy of {{facilityName}}'s Notice of Privacy Practices. I understand that this facility is required to abide by the terms of the Notice currently in effect. I also understand that the facility reserves the right to change its Notice and that I may obtain a revised copy upon request.</p>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Resident or Authorized Representative</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Print Name / Relationship (if signed by representative)</span>
    </div>
  </div>

  <p class="form-footer">If the resident or representative refused to sign or was unable to sign, please document: _________________________________ </p>
</article>`,
  },
  {
    id: 'financial-responsibility',
    name: 'Financial Responsibility Agreement',
    description: 'Resident and responsible party financial agreement.',
    category: 'resident',
    icon: 'file-text',
    templateContent: `<article class="form-page financial-responsibility-form">
  <p class="form-header">{{facilityName}}</p>
  <p class="form-header">FINANCIAL RESPONSIBILITY AGREEMENT</p>

  <p class="resident-name-row">Resident's Name: {{residentName}}&nbsp;&nbsp; Room: {{room}}&nbsp;&nbsp; Date of Admission: {{date}}</p>

  <h2 class="form-title">AGREEMENT FOR PAYMENT OF CHARGES</h2>

  <h3 class="underlined-heading">Responsible Party Agreement</h3>
  <p class="consent-paragraph">The undersigned ("Responsible Party") agrees to be responsible for payment of all charges for services rendered to the above-named resident by {{facilityName}}, in accordance with the rates and policies established by the facility. This includes, but is not limited to, room and board, nursing care, therapy services, medications, and ancillary services.</p>

  <h3 class="underlined-heading">Insurance Assignment and Billing</h3>
  <p class="consent-paragraph">The Responsible Party authorizes {{facilityName}} to bill Medicare, Medicaid, and any other insurance carriers on behalf of the resident. The Responsible Party assigns all benefits payable under the resident's insurance policies to the facility for services rendered. The Responsible Party agrees to promptly provide the facility with all information necessary for billing purposes.</p>

  <h3 class="underlined-heading">Personal Funds</h3>
  <p class="consent-paragraph">The Responsible Party acknowledges their obligation to ensure that the resident's monthly personal needs allowance (as required by applicable law) is available. The Responsible Party agrees to notify the facility promptly of any changes in the resident's financial status or insurance coverage.</p>

  <h3 class="underlined-heading">Non-Covered Services</h3>
  <p class="consent-paragraph">The Responsible Party understands and agrees to pay for services not covered by Medicare, Medicaid, or other third-party payers. The facility will provide written notice prior to providing non-covered services when possible.</p>

  <h3 class="underlined-heading">Discharge Planning</h3>
  <p class="consent-paragraph">In the event of discharge due to non-payment, the facility will provide reasonable notice and assist in arranging appropriate placement, in accordance with applicable law and facility policy.</p>

  <h3 class="underlined-heading">Agreement and Signatures</h3>
  <p class="consent-paragraph">By signing below, I acknowledge that I have read, understood, and agree to the terms of this Financial Responsibility Agreement. I understand that this agreement is a condition of admission and continued stay at {{facilityName}}.</p>

  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Signature of Responsible Party</span>
      <span class="signature-caption-date">Date</span>
    </div>
  </div>
  <div class="signature-block">
    <div class="signature-line-row">
      <div class="signature-line"></div>
      <div class="signature-date"></div>
    </div>
    <div class="signature-caption">
      <span class="signature-caption-label">Print Name / Relationship to Resident</span>
      <span class="signature-caption-date">Phone Number</span>
    </div>
  </div>

  <p class="form-footer">Facility Representative: _________________________________ &nbsp;&nbsp; Title: _________________ &nbsp;&nbsp; Date: __________</p>
</article>`,
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
  {
    id: 'covid19-vaccine-consent',
    name: 'Covid-19 Vaccine Consent Form',
    description: 'Two-page, portrait consent template rendered from source pages for exact print fidelity.',
    category: 'resident',
    icon: 'syringe',
    templateContent: `<article class="form-page covid-consent-template-page">
  <img
    class="covid-consent-image"
    src="/forms/covid-consent-p1.png"
    alt="Covid-19 Vaccine Consent Form - Page 1"
  />
</article>
<article class="form-page covid-consent-template-page">
  <img
    class="covid-consent-image"
    src="/forms/covid-consent-p2.png"
    alt="Covid-19 Vaccine Consent Form - Page 2"
  />
</article>`,
  },

];

export function useFormTemplates() {
  return {
    residentForms: DEFAULT_RESIDENT_FORMS,
  };
}
