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
  <div class="outlined-header">
    <p><strong>Resident name:</strong> {{residentName}} &nbsp;&nbsp; <strong>Unit:</strong> {{unit}} &nbsp;&nbsp; <strong>Room:</strong> {{room}}</p>
    <h1>Pain Medications: Understanding the Risks and Benefits</h1>
    <h2>An Educational Guide for Nursing Home Residents and Families</h2>
  </div>

  <h3>☑️ Why Pain Management Is Important</h3>
  <p>Pain affects your ability to move, rest, and enjoy daily life. Managing pain can improve comfort, function, and quality of life.</p>

  <h3>⚠️ Common Pain Medications</h3>
  <table>
    <thead>
      <tr><th>Type</th><th>Examples</th><th>Purpose</th></tr>
    </thead>
    <tbody>
      <tr><td>Acetaminophen</td><td>Tylenol</td><td>Mild pain, fever</td></tr>
      <tr><td>NSAIDs</td><td>Ibuprofen, Naproxen</td><td>Arthritis, inflammation</td></tr>
      <tr><td>Opioids</td><td>Oxycodone, Morphine</td><td>Moderate to severe pain</td></tr>
      <tr><td>Adjuvants</td><td>Gabapentin, Amitriptyline</td><td>Nerve or chronic pain</td></tr>
    </tbody>
  </table>

  <h3>✓ Benefits of Pain Medication</h3>
  <ul>
    <li>Improves comfort and sleep</li>
    <li>Enhances mobility and activity</li>
    <li>Supports mood and overall well-being</li>
    <li>Helps with healing and participation in therapy</li>
  </ul>

  <h3>⚠️ Potential Risks &amp; Side Effects</h3>
  <p><strong>All Medications:</strong></p>
  <ul>
    <li>Drowsiness, dizziness, constipation</li>
    <li>Nausea or upset stomach</li>
    <li>Dry mouth or confusion</li>
  </ul>

  <p><strong>Opioids Specific:</strong></p>
  <ul>
    <li>Risk of dependency or addiction</li>
    <li>Breathing problems (in overdose)</li>
    <li>Interactions with sedatives or alcohol</li>
  </ul>

  <p><strong>NSAIDs Specific:</strong></p>
  <ul>
    <li>Stomach bleeding or ulcers</li>
    <li>Kidney problems</li>
    <li>Increased blood pressure or heart risks</li>
  </ul>

  <h3>ℹ️ What You Can Do</h3>
  <ul>
    <li>Tell staff if you're in pain or have side effects</li>
    <li>Take medication as directed</li>
    <li>Ask questions before starting or changing any medications</li>
    <li>Participate in non-drug therapy options</li>
  </ul>

  <h3>🌿 Non-Medication Options</h3>
  <ul>
    <li>Heat/cold therapy</li>
    <li>Physical therapy/exercise</li>
    <li>Massage or repositioning</li>
    <li>Relaxation/music therapy</li>
  </ul>

  <h3>🤝 Our Commitment</h3>
  <p>We will monitor your pain, adjust treatments, and work with you and your family to keep you safe, informed, and comfortable.</p>

  <p class="signature-row"><strong>Provided to Resident/Representative:</strong> _______________________________ &nbsp;&nbsp; <strong>By:</strong> __________________</p>
</article>`,
  },
  {
    id: 'vaccine-consent-pneumo-flu',
    name: 'Pneumococcal & Influenza Vaccine Consent',
    description: 'Combined consent/refusal form for pneumococcal and influenza vaccinations.',
    category: 'resident',
    icon: 'syringe',
    templateContent: `<article class="form-page vaccine-consent-form">
  <div class="outlined-header centered">
    <p>{{facilityName}}</p>
    <h1>CONSENT FOR PNEUMOCOCCAL/INFLUENZA VACCINE ADMINISTRATION</h1>
    <p class="left"><strong>Resident's Name:</strong> {{residentName}}</p>
  </div>

  <h2>PNEUMOCOCCAL VACCINE</h2>

  <h3>Pneumococcal Consent</h3>
  <p>I have read, or had explained to me, the Vaccine Information Statements about pneumococcal vaccination. I understand the benefits and risks of the vaccination as described. The CDC recommends PCV15, PCV20, or PCV21 for adults 50 years and older who have not had a pneumococcal vaccine or are unsure of their vaccine history. If PCV15 was received, PPSV23 is given in 1 year and immunization is complete. If PCV20 or PCV21 is administered, no additional vaccination is recommended.</p>
  <p>☐ I consent to pneumococcal vaccination as described above.</p>
  <p>_______________________________________________ &nbsp;&nbsp; ______________<br/>Signature of Recipient (or Designated representative)&nbsp;&nbsp;&nbsp;&nbsp;Date</p>

  <h3>Pneumococcal Acceptance</h3>
  <p>I request that the pneumococcal vaccination as explained above be given to me (or the person named above for whom I authorized to make this request).</p>
  <p>_______________________________________________ &nbsp;&nbsp; ______________<br/>Signature of Recipient (or Designated representative)&nbsp;&nbsp;&nbsp;&nbsp;Date</p>

  <h3>Pneumococcal Refusal</h3>
  <p>I have decided to decline that the pneumococcal vaccination as explained above be given to me (or the person named above for whom I am authorized to make this request).</p>
  <p>_______________________________________________ &nbsp;&nbsp; ______________<br/>Signature of Recipient (or Designated representative)&nbsp;&nbsp;&nbsp;&nbsp;Date</p>

  <p class="divider">**********************************************************************</p>

  <h2>INFLUENZA VACCINE</h2>

  <h3>Influenza Consent</h3>
  <p>I have read, or had explained to me, the Vaccine Information Statement about influenza vaccination. I understand the benefits and risks of the vaccination as described. I request that the influenza vaccination be given to me (or the person named above for whom I am authorized to make this request).</p>
  <p>_______________________________________________ &nbsp;&nbsp; ______________<br/>Signature of Recipient (or Designated representative)&nbsp;&nbsp;&nbsp;&nbsp;Date</p>

  <h3>Influenza Refusal</h3>
  <p>I have decided to decline that the influenza vaccination as explained above be given to me (or the person named above for whom I am authorized to make this request).</p>
  <p>_______________________________________________ &nbsp;&nbsp; ______________<br/>Signature of Recipient (or Designated representative)&nbsp;&nbsp;&nbsp;&nbsp;Date</p>

  <p><em>This authorization is in effect until revocation by the above signed party. This consent will be used annually during review of vaccinations and to administer influenza vaccine yearly.</em></p>
</article>`,
  },
];

export function useFormTemplates() {
  return {
    residentForms: DEFAULT_RESIDENT_FORMS,
  };
}
