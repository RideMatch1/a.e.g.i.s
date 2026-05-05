# Data Processing Agreement (DPA) — International / EN

**Version**: v1.0 (2026-05-05)
**Template type**: Article 28 GDPR Data Processing Agreement, designed for cross-border vendor onboarding (US-based SaaS vendors: Cloudflare, AWS, Vercel, Supabase, Stripe, major-LLM-providers, etc.)
**Disclaimer**: This template does not constitute legal advice within the meaning of § 2 RDG (German Legal Services Act) or equivalent statutes. Individual legal review is required prior to production use, in particular for the third-country transfer constellation, sub-processor chain and sector-specific requirements.

---

## Parties

**Data Controller** (hereinafter: "Controller"):

> <Company / Name>
> <Address>
> <Authorized representative: name, function>
> <VAT-ID / Commercial register>
> Data Protection Officer: <name + contact> (where appointed under Art. 37 GDPR)

**Data Processor** (hereinafter: "Processor"):

> <Company / Name>
> <Address>
> <Authorized representative: name, function>
> <VAT-ID / Commercial register>
> Data Protection Officer: <name + contact>
> EU Representative under Art. 27 GDPR: <name + contact> (where Processor is established outside EU/EEA)

— hereinafter jointly: "the Parties" —

---

## Recitals

(A) The Parties have entered into a master agreement on <date> regarding <description of services — e.g., "the provision of cloud hosting services", "SaaS analytics platform", "AI inference API"> ("Main Agreement").

(B) In the course of performing the Main Agreement, the Processor processes personal data on behalf of the Controller within the meaning of Art. 4(8) GDPR.

(C) This Data Processing Agreement ("DPA") sets out the obligations of the Parties pursuant to Art. 28(3) GDPR. Where the Controller is subject to UK GDPR, Swiss revFADP or other adequate-equivalent regimes, the corresponding annexes apply (see § 10).

(D) In the event of a conflict between the Main Agreement and this DPA, this DPA prevails to the extent that data-protection obligations are concerned.

---

## § 1 Subject Matter and Duration (Art. 28(3)(a) GDPR)

**1.1 Subject matter**: The Processor processes personal data on behalf of the Controller for the purpose of providing the services agreed upon in the Main Agreement and described in **Annex I**.

**1.2 Duration**: This DPA enters into force on <effective date> and remains in effect for the term of the Main Agreement, ending no later than upon completion of return or deletion obligations under § 9.

---

## § 2 Nature and Purpose of Processing

**2.1**: Nature, scope, and purpose of processing are detailed in **Annex I**.

**2.2**: The Processor shall not process personal data for its own purposes, in particular for marketing, profiling, or analytics outside the scope of the Main Agreement, unless explicitly described in **Annex I** and lawful under Art. 6 GDPR.

**2.3 AI/ML training data prohibition** (where applicable): The Processor shall not use the Controller's personal data to train, retrain, or fine-tune machine-learning models without the Controller's explicit prior written consent, irrespective of whether such use would otherwise be lawful.

---

## § 3 Categories of Personal Data and Data Subjects

**3.1**: The categories of personal data processed and categories of data subjects are listed in **Annex I**.

**3.2 Special categories**: Processing of special categories of personal data under Art. 9 GDPR or criminal-conviction data under Art. 10 GDPR shall occur **<only as expressly listed in Annex I / not at all>**. Where applicable, enhanced TOMs under **Annex II** apply.

---

## § 4 Obligations of the Processor (Art. 28(3)(b)–(h) GDPR)

**4.1 Documented instructions (Art. 28(3)(a), Art. 29 GDPR)**: The Processor shall process personal data only on documented instructions from the Controller, including with regard to international transfers, unless required to do so by Union or Member State law. The Processor shall inform the Controller of such legal requirement before processing, unless prohibited by that law on important grounds of public interest. If the Processor considers an instruction to infringe applicable data-protection law, it shall inform the Controller without undue delay.

**4.2 Confidentiality (Art. 28(3)(b))**: The Processor ensures that persons authorised to process personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality. The obligation survives termination of employment.

**4.3 Security of processing (Art. 28(3)(c), Art. 32)**: The Processor implements the technical and organisational measures set out in **Annex II**.

**4.4 Sub-processors (Art. 28(2), (4))**: As governed by § 6.

**4.5 Assistance with data-subject rights (Art. 28(3)(e))**: The Processor shall, taking into account the nature of the processing, assist the Controller by appropriate technical and organisational measures, insofar as possible, in fulfilling the Controller's obligation to respond to data-subject requests under Chapter III GDPR. The Processor shall forward any data-subject request received directly to the Controller within **<72 hours / 5 business days>** without responding itself, unless instructed otherwise.

**4.6 Assistance with Controller obligations (Art. 28(3)(f))**: The Processor shall assist the Controller in ensuring compliance with Art. 32–36 GDPR, in particular with security of processing, breach notification, breach communication, DPIA, and prior consultation.

**4.7 Personal-data-breach notification (Art. 33(2))**: The Processor shall notify the Controller of any personal-data breach without undue delay, no later than **24 hours** after becoming aware of the breach. The notification shall contain at minimum:

a) description of the nature of the breach (categories and approximate number of data subjects + records),
b) name and contact details of the DPO or other contact point,
c) likely consequences of the breach,
d) measures taken or proposed to address the breach.

**4.8 Return / deletion (Art. 28(3)(g))**: As governed by § 9.

**4.9 Audits (Art. 28(3)(h))**: As governed by § 8.

**4.10 Records of processing (Art. 30(2))**: The Processor maintains records of all categories of processing activities carried out on behalf of the Controller and makes them available to the Controller and the supervisory authority upon request.

**4.11 EU Representative (Art. 27)**: Where the Processor has no establishment in the EU/EEA, it shall designate in writing a representative in the Union and provide contact details to the Controller.

---

## § 5 Technical and Organisational Measures (Art. 32 GDPR)

**5.1**: The Processor implements at the time of contract conclusion the technical and organisational measures described in **Annex II**, ensuring a level of security appropriate to the risk.

**5.2**: The TOMs are reviewed at least **annually** and adapted to the state of the art and changing risk landscape. Material changes shall be communicated to the Controller in writing prior to implementation.

**5.3 Encryption**: Data in transit shall be encrypted using TLS ≥ 1.2 (preferably 1.3); data at rest shall be encrypted using AES-256 or equivalent.

**5.4 Resilience and recovery**: RPO/RTO targets and backup strategy are documented in **Annex II**.

---

## § 6 Sub-Processors (Art. 28(2), (4) GDPR)

**6.1 General authorisation**: The Controller grants **<general / specific>** prior authorisation for the engagement of sub-processors. The sub-processors engaged at the time of contract conclusion are listed exhaustively in **Annex III**.

**6.2 Notification of changes**: The Processor shall notify the Controller at least **30 calendar days** in advance of any intended addition or replacement of sub-processors, providing name, address, processing activity and location.

**6.3 Right to object**: The Controller may object to such changes within **14 calendar days** for legitimate data-protection reasons. If no agreement is reached, the Controller may terminate the affected services for cause.

**6.4 Flow-down**: The Processor shall impose on each sub-processor, by way of a written contract, the same data-protection obligations as set out in this DPA, in particular providing sufficient guarantees to implement appropriate TOMs.

**6.5 Liability**: Where a sub-processor fails to fulfil its data-protection obligations, the Processor remains fully liable to the Controller for the performance of the sub-processor's obligations.

**6.6 Third-country sub-processors**: Where a sub-processor is located in a third country without an adequacy decision under Art. 45 GDPR, the Processor shall conclude appropriate safeguards under Art. 46 GDPR (in particular SCC Module 3 — see **Annex IV**) and conduct a Transfer Impact Assessment.

---

## § 7 Cooperation with Data Subjects and Authorities

**7.1**: The Parties shall cooperate in good faith and provide each other with relevant documentation in the event of data-subject claims under Art. 82 GDPR or supervisory-authority inquiries under Art. 58 GDPR.

**7.2 Costs**: Cost of assistance shall be governed by the Main Agreement; first-line measures necessary to safeguard data-subject rights are not separately chargeable where caused by Processor's breach.

---

## § 8 Audits (Art. 28(3)(h) GDPR)

**8.1**: The Processor shall make available to the Controller all information necessary to demonstrate compliance with the obligations laid down in this DPA, including ISO 27001 certificates, SOC 2 Type II reports, BSI-Grundschutz attestations, or equivalent.

**8.2**: The Controller (or a qualified third-party auditor mandated by the Controller) shall be entitled to audit the Processor's compliance, in accordance with one of the audit variants set out in **Annex V (Audit Variants)**:

- **Variant A**: On-site audit
- **Variant B**: Remote audit (document and system review)
- **Variant C**: SOC 2 / ISO 27001 surrogate audit (acceptance of third-party-auditor report)

**8.3 Frequency**: Audits occur **<annually / on a risk-based cadence>**, plus additional audits triggered by reasonable suspicion or following a personal-data breach.

**8.4 Notice and confidentiality**: Audits require at least **14 calendar days** prior notice (except in cause-driven cases), shall preserve confidentiality, and shall not unreasonably disrupt business operations.

**8.5 Costs**: Each Party bears its own costs. If material non-compliance is identified, the Processor bears the reasonable auditor costs.

---

## § 9 Return and Deletion of Data (Art. 28(3)(g) GDPR)

**9.1**: Upon termination of the services — at the latest **<30 / 60 / 90> calendar days** after termination — the Processor shall, at the Controller's option:

a) **return** all personal data in a machine-readable, structured format (JSON, CSV, XML, etc.), or
b) **delete** all personal data and confirm deletion in writing.

**9.2 Backup deletion**: Personal data in backup systems shall be deleted within **<90 / 180> calendar days** or, until deletion, isolated from access.

**9.3 Statutory retention**: Where Union or Member State law requires retention (e.g., German Commercial Code §§ 257, 147 AO), processing shall be restricted under Art. 18 GDPR; data shall be deleted upon expiry of retention obligations.

**9.4 Deletion certificate**: Upon request, the Processor provides a deletion certificate covering all copies including those at sub-processors.

---

## § 10 International Transfers (Chapter V GDPR)

**10.1**: Transfers to third countries occur only on documented instructions from the Controller or where required by law.

**10.2 Safeguards**: Where no adequacy decision exists, the Parties rely on the following safeguards (as applicable):

- **EU/EEA / adequacy**: no additional safeguards required.
- **EU-US Data Privacy Framework**: active certification of recipient must be verified at https://www.dataprivacyframework.gov.
- **Other third country**: SCC 2021/914 Module 2 (Controller→Processor) or Module 3 (Processor→Sub-processor) — see **`AVV-anhang-SCC-module2-controller-processor.md`** / **`AVV-anhang-SCC-module3-processor-subprocessor.md`**.
- **United Kingdom**: UK International Data Transfer Addendum — see **`AVV-anhang-UK-IDTA.md`**.
- **Switzerland**: Swiss revFADP addendum — see **`AVV-anhang-CH-revDSG.md`**.

**10.3 Transfer Impact Assessment (TIA)**: The Processor, in coordination with the Controller, shall conduct a TIA per EDPB Recommendations 01/2020 prior to any transfer relying on Art. 46 safeguards, and document the result.

**10.4 Government access requests**: If the Processor receives a legally binding request from a third-country authority for disclosure of personal data, it shall notify the Controller without undue delay (where legally permissible) and challenge the request through all available legal means.

**10.5 SCC incorporation by reference**: The Standard Contractual Clauses 2021/914 Module 2 (Controller→Processor) are hereby incorporated by reference and govern the transfer with respect to non-adequacy third countries. The annexes to the SCCs are populated as set out in **`AVV-anhang-SCC-module2-controller-processor.md`**.

---

## § 11 Liability

**11.1**: The Parties are jointly and severally liable to data subjects under Art. 82 GDPR.

**11.2 Internal allocation**: As between the Parties, each bears the share of damage corresponding to its responsibility. Sub-processor breaches are attributed to the Processor under § 6.5.

**11.3 Administrative fines**: Fines under Art. 83 GDPR are borne by the Party to which the breach is attributable.

**11.4 Liability caps**: Liability caps in the Main Agreement do not apply to GDPR-mandated liabilities to the extent statutory law prohibits limitation.

---

## § 12 Final Provisions

**12.1 Form**: Amendments require text form; Art. 28(9) GDPR permits electronic form.

**12.2 Severability**: If any provision of this DPA is held invalid, the remaining provisions remain in effect.

**12.3 Governing law**: This DPA is governed by the laws of **<Germany / Member State of Controller's establishment>**, without prejudice to mandatory provisions of the GDPR.

**12.4 Jurisdiction**: Exclusive jurisdiction lies with the courts of **<Controller's seat>**, where both Parties are commercial entities.

**12.5 Precedence**: This DPA prevails over conflicting provisions of the Main Agreement on matters of data protection.

---

## Annexes

| Annex | Title | Reference |
|-------|-------|-----------|
| I | Description of processing | (embedded — analogous to SCC Annex I) |
| II | Technical and organisational measures (Art. 32 GDPR) | `AVV-anhang-TOMs.md` |
| III | List of sub-processors | `AVV-anhang-Sub-Processor-List.md` |
| IV | International-transfer modules | `AVV-anhang-SCC-module2-controller-processor.md` / `…-module3-processor-subprocessor.md` / `…-UK-IDTA.md` / `…-CH-revDSG.md` |
| V | Audit-clause variants | `AVV-anhang-Audit-Klausel-Varianten.md` |

---

## Annex I — Description of Processing

**I.1 Nature and purpose**:
> <e.g., "Hosting and provision of the SaaS analytics platform XYZ including database, backup and support services, for the purpose of fulfilling the Main Agreement.">

**I.2 Categories of personal data**:
> <e.g., master data (name, address, email), contract data, usage data (login timestamps, IP), communication data, payment data via external PSP per Annex III.>

**I.3 Special categories (Art. 9/10 GDPR)**:
> <none / description with enhanced TOMs per Annex II>

**I.4 Categories of data subjects**:
> <Customers, employees, suppliers, app end-users, website visitors, …>

**I.5 Frequency of transfer**:
> <continuous / one-off / periodic>

**I.6 Retention period**:
> <duration of contract + 30 days / per statutory retention period>

**I.7 Processing locations**:
> <data-centre regions; sub-processor locations per Annex III>

**I.8 Recipients / categories of recipients**:
> <internal staff of Processor; sub-processors per Annex III>

**I.9 Third-country transfers**:
> <yes / no; safeguard mechanism per Annex IV>

---

**Place, date, signatures**:

> _______________________________
> Controller: <name, function>
> Place, date

> _______________________________
> Processor: <name, function>
> Place, date
