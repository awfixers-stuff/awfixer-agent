# AWFixer Source Available License v0.4

### 1. Definitions

- **“Licensor”** means the copyright holder(s) offering the Software under this License.
- **“You” / “Licensee”** means any individual or legal entity exercising permissions granted by this License.
- **“Software”** means the source code, object code, documentation, specifications, build scripts, configuration, and any other materials made available by Licensor under this License.
- **“Source Available”** means the Software’s source is viewable and usable only under the conditions of this License.
- **“Use”** means to access, view, run, execute, install, compile, reproduce, modify, adapt, translate, create derivative works of, distribute, convey, make available, host, provide as a service, benchmark, test, or otherwise exploit the Software, in whole or in part.
- **“Derivative Work”** has the meaning under applicable copyright law, and includes any work based on or incorporating any portion of the Software.
- **“Confidential Information”** means any non-public information included in or derivable from the Software, including architecture, roadmaps, designs, comments, test data, build pipelines, and non-public APIs, to the extent not publicly disclosed by Licensor.
- **“Competitive Offering”** means any product or service (including SaaS, hosted service, on-prem software, embedded software, library, SDK, model, agent, or API) that provides materially the same primary functionality as the Software (or any material portion of it), as reasonably understood by a person skilled in the art, including where it is the same as, substantially similar to, or functionally competitive with the Software or any material portion of it, or can reasonably substitute for the Software in the marketplace, or is intended to be used for the same or substantially similar primary purpose as the Software. For the avoidance of doubt, a product is a Competitive Offering if it is marketed or positioned as an alternative to the Software or performs the same core workflows that the Software was designed to handle.
- **“Functionally Equivalent”** means implementing materially the same features, behaviors, workflows, interfaces, data models, protocols, endpoints, schemas, command sets, or operational semantics, whether or not the code is textually similar.
- **“Artificial Intelligence System” / “AI System”** means any machine learning system, neural network, language model, multimodal model, embedding model, code assistant, agentic system, classifier, or similar system, whether provided by You or a third party.
- **“Training”** means training, pre-training, fine-tuning, continued training, reinforcement learning, distillation, supervised learning, unsupervised learning, self-supervised learning, retrieval-augmentation indexing, embedding generation, dataset construction, or any process that uses the Software (or any portion of it) as input to improve, parameterize, evaluate, or influence an AI System.
- **“AI Consumption”** means any ingestion, parsing, indexing, embedding, vectorization, annotation, labeling, tokenization, transformation, or processing of the Software by or for an AI System, including for Training.
- **“Prohibited AI Use”** means any AI Consumption of the Software except as expressly permitted under Section 4, or any use that results in the Software or its Confidential Information being incorporated, in whole or in part, into the parameters, weights, embeddings, or reasoning patterns of any AI System.
- **“Change Date”** means four (4) years after the date on which Licensor first makes this version of the Software available under this License.

### 2. Grant of rights (limited)

Subject to Your continuous compliance with this License, Licensor grants You a limited, non-exclusive, non-transferable, non-sublicensable license to:

- view and internally evaluate the Software;
- run the Software for internal purposes; and
- modify the Software for internal purposes,

**provided** that academic or security research Use that is non-commercial and not for a Competitive Offering is permitted, so long as You do not publish or distribute any Software, Derivative Works, benchmarks, or other materials that enable a Competitive Offering or Functionally Equivalent software, and You comply with Sections 3–6.

**in each case** only as permitted by this License and only if such Use does not fall within Restricted Uses in Section 3 or Prohibited AI Use in Section 4.

#### 2.1 Personal, Small Entity, and Growth Grace Period

Notwithstanding any other provision, natural persons (individuals) and small entities (≤10 employees or <$2M USD annual revenue) may use, modify, and run the Software for personal, educational, or internal business purposes, including limited production use, provided they do not create or operate a Competitive Offering and comply with Sections 3, 4, and 6. This includes personal projects, self-hosted instances, and non-public tools.

If a small entity grows beyond the thresholds above, it shall have a grace period of one hundred eighty (180) days from the date it first exceeds either threshold to either (a) obtain a separate commercial license from Licensor or (b) cease any Use that would otherwise violate this License. Licensor will not pursue enforcement actions against such entities solely for crossing the threshold during this grace period, provided they act in good faith.

### 3. Restricted uses (competition, functional equivalents)

Unless Licensor grants You a separate written commercial license, You must **not**, and must not permit any third party to:

1. **Develop or enable a Competitive Offering.** Use the Software to develop, improve, train, operate, or provide any Competitive Offering.
2. **Create Functionally Equivalent software.** Use the Software (including exposure to its source, architecture, interfaces, or behavior) to build, design, implement, or validate Functionally Equivalent software.
3. **Benchmarking and competitive analysis publication.** You may not publish benchmarks, comparisons, evaluations, or performance results of the Software without Licensor’s prior written consent.

**Note**: Independent development of similar functionality (including good-faith clean-room implementations) that does not rely on the Software, knowledge directly derived from it, or Prohibited AI Use is not prohibited by this License.

**Examples (non-exhaustive)** of prohibited conduct:

- Reading the codebase, then implementing a “new” library/API that matches the same endpoints, schemas, or behaviors using the Software as reference.
- Using the Software as reference to recreate identical workflows, UI flows, or system behavior, even with different naming.
- Using the Software to generate, index, or distill interfaces for competing code-generation agents, RAG systems, autonomous tooling, or similar AI Systems.
- Extracting or replicating scheduling policies, capability or permission models, secure-boot flows, IPC mechanisms, driver interfaces, or system-call semantics into any Competitive Offering or Functionally Equivalent software.

### 4. AI / ML restrictions

Unless Licensor grants You a separate written commercial license, You must **not** perform Prohibited AI Use.

#### 4.1 Prohibited AI Use includes (non-exhaustive)

- Training any AI System on the Software.
- Fine-tuning or continued training using the Software.
- Creating embeddings, vector databases, or retrieval indexes from the Software where the purpose overlaps with creating a Competitive Offering.
- Using the Software to create synthetic training data, labels, annotations, or instruction-tuning datasets for a Competitive Offering.
- Distilling, extracting, or learning behaviors, patterns, interfaces, or implementation details from the Software into an AI System whose primary purpose overlaps with the Software or any Competitive Offering.
- Using any output, summary, or derivative generated by an AI System that consumed the Software in a manner that would itself be prohibited.

#### 4.2 Limited permitted AI assistance (narrow)

You may use an AI System **only** for ephemeral assistance (for example, autocomplete on code You authored) **if**:

- no portion of the Software is provided to the AI System beyond snippets strictly necessary for the immediate task;
- the AI provider is contractually prohibited from Training on, retaining, or using those inputs; and
- You maintain records sufficient to demonstrate compliance.

If You cannot satisfy all conditions above, the AI use is Prohibited AI Use.

### 5. Compliance, controls, and audit support

To provide enforceable compliance hooks, You agree to:

- **Records.** Maintain complete and accurate records reasonably sufficient to demonstrate compliance with Sections 3 and 4, including (as applicable) AI tool/vendor names, settings, retention/training toggles, dates of use, and an inventory of any code or documentation provided to AI Systems.
- **Certification.** Upon Licensor’s written request (limited to once per calendar year), provide a written certification of compliance signed by an authorized representative (or by the individual for natural persons).
- **Incident notice.** Promptly notify Licensor upon discovery of any actual or suspected breach relating to Competitive Offerings, Functionally Equivalent software, or AI Consumption.
- **Audit (limited).** If Licensor has a reasonable basis to suspect material non-compliance, You will cooperate with a limited compliance review by an independent auditor under NDA, limited to verifying compliance with Sections 3–5 and focused only on records reasonably suspected of containing Software-derived material. Licensor may exercise this right through counsel or retained experts. Licensee shall bear its own costs unless the audit reveals no material breach, in which case Licensor reimburses reasonable audit costs.

#### 5.1 Logging and Tampering

The Software maintains local, on-device logs of usage, access, modifications, and AI interactions solely for compliance verification. These logs are not transmitted to Licensor except for minimal tamper-detection events (e.g., alerts that logging has been disabled, circumvented, or deleted). Licensor does not collect, store, or access substantive usage data, source code, or any other private information from Licensee’s systems.

You must not disable, circumvent, delete, or cause the deletion of these logs. Any attempt to do so, or failure to preserve logs upon reasonable request, constitutes a material breach and evidence spoliation. Licensee agrees that destruction or alteration of such logs creates a rebuttable presumption of willful violation of Sections 3 and 4.

**Preservation Obligation.** Upon receipt of a preservation notice from Licensor, Licensee must immediately preserve all relevant records, logs, models, and systems for the duration of any dispute.

### 6. Distribution and external use

Unless Licensor grants You a separate written commercial license, You must not distribute, convey, sublicense, sell, or make the Software available to any third party, including by:

- hosting the Software in a public repository;
- providing the Software as a service;
- offering access to the Software via an API; or
- distributing binaries built from the Software;
- incorporating any portion of the Software into any model, dataset, corpus, weights, embedding store, or similar artifact that is distributed or made available under terms more permissive than this License.

### 7. Delayed relicensing to AGPL

The Change Date for this version of the Software is exactly four (4) years after the date on which Licensor first makes this version available under this License. On and after the Change Date, the license for this version automatically converts to the GNU Affero General Public License, version 3 (AGPL-3.0), or any later version published by the Free Software Foundation.

### 8. Intellectual property; no implied rights

- **No trademark rights.** This License does not grant rights to use Licensor’s trademarks, logos, or branding.
- **No patent grant unless stated.** No patent rights are granted unless Licensor expressly provides a patent license in writing.
- **Reservation of rights.** All rights not expressly granted are reserved.

### 9. Termination and remedies

- **Automatic termination.** Any breach of Sections 3, 4, or 5.1 immediately terminates Your rights under this License. For other breaches, Licensor may terminate on 30 days’ written notice unless cured.
- **Injunctive relief.** You agree that breaches involving Competitive Offerings or Prohibited AI Use will cause Licensor irreparable harm for which monetary damages are insufficient, and You consent to immediate injunctive and equitable relief without bond or security in any court of competent jurisdiction.
- **Cure.** Licensor may, at its sole discretion, provide a cure period in writing.

### 10. Disclaimer of warranty

THE SOFTWARE IS PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

### 11. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL LICENSOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO THIS LICENSE OR THE SOFTWARE.

### 12. Governing law; venue

This License and any dispute arising out of or related to it (including any non-contractual disputes or claims) will be governed by the laws of the State of Delaware, U.S.A., without regard to its conflict of law principles.

**Exclusive venue.** Subject to the Chancery carve-out below, the parties agree that any action, suit, or proceeding arising out of or related to this License or the Software will be brought exclusively in the United States District Court for the District of Delaware, and each party irrevocably submits to the personal jurisdiction and venue of such court.

**Court of Chancery carve-out.** To the extent a claim is within the subject matter jurisdiction of the Delaware Court of Chancery (including claims seeking equitable relief), Licensor may, at its option, bring such claim exclusively in the Delaware Court of Chancery (or, if that court lacks jurisdiction, in the Delaware Superior Court), and You irrevocably submit to the personal jurisdiction and venue of such court.

You waive any objection to such courts based on forum non conveniens or any similar doctrine.

### 13. No Waiver; Cumulative Remedies

Failure by Licensor to enforce any provision of this License does not constitute a waiver of its rights. All remedies provided herein are cumulative and in addition to any other remedies available at law or in equity.
