# CASA Colombia 3.1 and Resolución 0194 de 2025: research brief for a greenr CASA scheme

Research date: 21 October 2026. I read the sources in Spanish and wrote this brief in English. Credit names stay in Spanish in parentheses. I did not modify the greenr repo.

Page references use the page number printed in the CASA guide ("Página N de 274"). The PDF page is one higher because of the cover, the same offset greenr's `lib/edge/guide.ts` already uses for EDGE. Link format: `https://casa.cccs.org.co/wp-content/uploads/2026/08/2026_CASA-Colombia-V3.pdf#page=<printed+1>`.

Local copies are in `scratchpad/casa/`: the CASA PDF, per-page text in `pages/pNNN.txt` (PDF page numbering), the Minvivienda ABC, Adenda 01, Adenda 02 and the CCCS transition note. `scratchpad/casa/res0194/` holds the full text of Res. 0194, Anexo 2 and Anexo 3.

---

## 0. Summary

- **CASA Colombia 3.1** ("Guía de Certificación CASA, Edición 2026") has 9 categories with 13 prerequisites and 36 credits, worth 110 points. Up to 15 more points are possible through the pilot option of CCRc4. Levels differ for VIS and non-VIS projects. Registration in 3.1 opened on 1 Aug 2026. Reviews of 3.1 projects move from Bureau Veritas to GBCI, on the Arc platform.
- **Res. 0194 de 2025** sets mandatory water and energy savings. Each target is a percentage below a 2020 baseline, set by use type and climate zone. Climate zones are Frío, Templado, Cálido seco and Cálido húmedo. The phase-in for VIS/VIP depends on the municipality category and the project area. **VIS/VIP projects of 2,000 m² or more in category E, 1 and 2 municipalities become mandatory on 24 Oct 2026, three days after this brief.**
- **Homologation.** On 24 Nov 2025 Minvivienda accepted CASA V3 as an alternative to the municipal Mecanismo de Seguimiento y Control (MS&C) for verifying the savings in the construction phase. Adenda 01 (June 2026) extended this to V1.1 and V2.1 under CASA Adenda 008. **Adenda 02 (August 2026) extended it to V3.1.** I found Adenda 02 by web search. It was not in the brief's source list, and the CCCS transition note dated 4 Aug 2026 still calls the endorsement "en proceso".
- **Feasibility against greenr today.** None of the 14 items the hypothesis classed as "viewer" can be computed from the current snapshot. Every one needs new Revit categories or parameters. The most common gap is a **dwelling-unit key on rooms**. CASA counts occupants as bedrooms + 1 per unit, and greenr has no concept of a unit. What is computable today, or with typed inputs only, is narrower:
  - WWR per façade, re-binned to 4 orientations (GGc5, SBp3 and the MS&C form).
  - Room and opening elevations compared against a typed road level or flood level (CCRp3 and CCRc4).
  - Roof area, which feeds the Ap1 runoff coefficient.
  - Glazing U, SHGC and VT, which feed SBp3 and Ep1.
- **Recommended first slice**, ranked by value against cost:
  1. A CASA / Res. 0194 envelope sheet. It needs no new fields.
  2. A flood and grade check for CCRp3 and CCRc4. It needs only typed elevations.
  3. Natural ventilation at 4% openable area (SBp1) plus 15% glazing per unit (SBc6). It needs an operable-area parameter and a unit key.
  4. Ap3 fixture flows checked against NTC 1500 maxima. It needs the Plumbing Fixtures category and a unit key.
  5. Mc4 non-structural partition share, as a stretch.
- **Licensing.** CASA has no reuse licence, and the website footer reads "All Rights Reserved". Annexes 2 and 3 of Res. 0194 carry an explicit ban on reproduction without written authorisation from Minvivienda. Until that is cleared, do not bundle the municipality-to-climate table. Ask the user for the zone and link out.

---

## 1. CASA Colombia 3.1 structure

### 1.1 Document identity

| Field | Value |
|---|---|
| Title on cover | "Guía de Certificación CASA, Edición 2026" (CCCS seal) |
| Version stated in the text | "lineamientos ... para su versión 3.1" (p. 4) |
| File | `2026_CASA-Colombia-V3.pdf`, uploaded 2026/08. PDF created 11 Aug 2026, modified 18 Aug 2026. Author metadata: "Colombia gbc/ brazil gbc/ guatemala gbc". 275 PDF pages. |
| Scope | New residential projects, VIS and non-VIS (p. 4). CASA is an international system shared by the GBCs of Brazil, Guatemala and Colombia. CASA Colombia is the national adaptation, led by CCCS (p. 3–4). |
| Draft artefacts in the published PDF | The table of contents shows "¡Error! Marcador no definido.". Page 5 carries the editor note "Hay que generar nuevos íconos para las categorías". BEc3 and GGc7 are missing from the table of contents. The GGc7 heading prints as "Gc7." (p. 43). Points disagree in places: Ec2 is 9 in the summary table but 10 on the credit page; SBc2 is 4 in the summary but 3 on the credit page (4 only for detached single-family houses). |

### 1.2 Categories, prerequisites and credits (summary table pp. 6–7)

"En total, el sistema cuenta con 49 créditos/prerrequisitos ... 13 prerrequisitos, 36 créditos ... La puntuación máxima ... es de 110 puntos" (p. 5).

| Category | Items (points, P = prerequisite) |
|---|---|
| Gobernanza y Gestión (17 pts) | GGp1 Liderazgo y colaboración (P), GGc2 Liderazgo y colaboración avanzado (4), GGc3 Comisionamiento (3), GGc4 Profesional acreditado (1), GGc5 Estudio bioclimático (3), GGp6 Gestión de los impactos durante la construcción (P), GGc7 Gestión avanzada de los impactos durante la construcción (4), GGp8 Gestión de residuos durante la operación (P), GGc9 Gestión avanzada de residuos durante la operación (2) |
| Cambio climático y Resiliencia (11–25 pts) | CCRp1 Huella de carbono del proyecto (P), CCRc2 Reducción de la huella de carbono del proyecto (6), CCRp3 Resiliencia del proyecto (P), CCRc4 Mejora en la resiliencia del proyecto (5–20) |
| Biodiversidad y Entorno (12) | BEc1 Selección adecuada del terreno (2), BEc2 Preservación y regeneración del hábitat local (4), BEc3 Preservación del microclima urbano (2), BEc4 Movilidad (2), BEc5 Usos mixtos (2) |
| Agua (16) | Ap1 Gestión del agua lluvia (P), Ac2 Gestión avanzada del agua lluvia (4), Ap3 Reducción del consumo de agua interior (P), Ap4 Reducción del consumo de agua exterior (P), Ac5 Reducción del consumo de agua global (7), Ac6 Uso de fuentes alternativas de agua (3), Ac7 Tratamiento de agua (2) |
| Energía (13 in the summary, 14 on the category page) | Ep1 Eficiencia energética (P), Ec2 Eficiencia energética mejorada (9; the credit page says 10), Ec3 Energías renovables (3), Ec4 Electrificación (1) |
| Salud y Bienestar (16) | SBp1 Calidad del aire interior (P), SBc2 Calidad avanzada del aire interior (4), SBp3 Desempeño térmico (P), SBc4 Desempeño térmico avanzado (4), SBc5 Confort acústico (2), SBc6 Desempeño de la iluminación interior (2), SBc7 Hábitos saludables (2), SBc8 Interacción social (1), SBp9 Acceso universal al proyecto (P), SBc10 Acceso universal avanzado (1) |
| Materiales (10) | Mc1 Política de compras (2), Mc2 Productos con DAPs (3), Mc3 Materiales preferibles (3), Mc4 Circularidad (2) |
| Valor Social (9) | VSp1 Educación (P), VSc2 Cultura de sostenibilidad (3), VSc3 Prácticas de sostenibilidad corporativa (4), VSc4 Infraestructura para la comunidad (2) |
| Innovación (6) | Ic1 Innovación (2), Ic2 Desempeño extraordinario (4) |

The 110 total counts CCRc4 at 5 points. The CCRc4 Option 2 pilot can award "5 puntos del crédito y 15 puntos adicionales a los 110" (p. 78).

### 1.3 Certification levels (p. 8)

| Level | Non-VIS | VIS |
|---|---|---|
| Platino | 80–110 | 70–110 |
| Oro | 60–79 | 40–69 |
| Plata | 50–59 | 20–39 |
| Verde | 40–49 + prerequisites | Prerequisites only |

Every project also gets a **resilience level from F to AA** (pp. 11–13):

- **F:** no measures.
- **E:** all prerequisites met.
- **D / C:** CCRc4 Option 1 with 2 or 4 measures.
- **B / A / AA:** CCRc4 Option 2, a future-scenario analysis (SSP2-RCP4.5, 2050) reaching Mejorado, Robusto or Superior.
- **B+ / A+ / AA+:** as above, plus at least one community resilience measure.

Every project reports these key indicators (p. 8):

- tCO2e per year (operational) and per m² (embodied).
- kWh/m²·yr, kWh/yr and kWh/yr reduced.
- m³/yr, L/hab/day and m³/yr reduced.
- Resilience level.
- Percentage of construction and demolition waste (RCD) diverted, and RCD per m².

### 1.4 Process, platform and costs

The process is described on pp. 9–10.

1. **Registration with CCCS.** The developer signs the quotation and the "Formato de Acuerdo de Registro", then pays. CCCS assigns a technical contact and brings in the auditing entity.
2. **Optional precertification.** CCCS reviews within 7 business days, based on the project narrative and design support documents.
3. **Design review.** The auditor reviews in 10 business days and the team has 15 business days to answer comments. A final review follows. No further review is possible until the construction stage.
4. **Construction review.** Same two-step pattern. The auditor's final review also takes 10 business days. It is done per registered stage. A single combined design-and-construction submission is possible, with 20 business days of review.
5. **Final on-site audit**, per stage.
6. **Certificate** by email, 7 business days after the site audit report is approved.

Phased projects need a commitment letter for items that cannot yet be verified. Pending documentation must be sent within 6 months of the phase completing.

**Who certifies, and on which platform.** This comes from the CCCS transition note "Lanzamiento de la Certificación CASA Colombia V3.1 y Lineamientos para la Transición de Proyectos" (`/wp-content/uploads/2026/08/CASA-Colombia-V3.1-y-Lineamiento.pdf`):

- "Se migra el proceso de revisión y certificación de Bureau Veritas a GBCI" for V3.1, through the new CASA platform at `https://arc-app.gbci.org/projects/list/casa`.
- V3 and older versions stay with Bureau Veritas on the current platform.
- CCCS keeps local technical support and billing.
- The CCCS site also promotes a "Plataforma CASA" for free prediagnosis.

**Transition dates** (same note):

- V3.1 registration opens 1 Aug 2026.
- V3 registration closes 18 Dec 2026.
- V3 projects must reach final certification by 31 Dec 2033.
- V3 projects that have not started design review can migrate to V3.1 for free and receive a 2-point Innovation bonus.
- The note says 86% of the technical requirements are unchanged from V3.

**Costs.** The standard states no fees. The site has a fee estimator at `https://casa.cccs.org.co/calculador-y-registro/`. It takes the number of stages, dwelling units and typologies, and computes the result server-side. A "typology" is defined by the number of bedrooms with no more than a 10% difference in the weighted private area. The site says "Los valores ... son aproximados y pueden variar con los indicados en la cotización oficial".

### 1.5 Tools and calculators

**Named in the guide** (with printed page):

| Tool | Page |
|---|---|
| CCRp3 "Análisis de Resiliencia" tool | p. 68 |
| Hoja de cálculo "CCRc4_Desempeño Resiliencia" | p. 81 |
| Calculador CCRp1 and the CASA carbon footprint tool | p. 58 ff. |
| Calculador BEc4 | , |
| "Calculador CASA de Consumo de Agua" (also called Calculador Ap3) | pp. 126–131 |
| Calculador Ac6 | , |
| "Ep1_CASA_Calculador prescriptivo" | pp. 153–156 |
| "Ep1_CASA_Calculador desempeño" | pp. 156–159 |
| "Protocolo de Modelación CASA", with its annex of mandatory provisions | pp. 152–154 |
| "Calculador CASA Uso de Energía y GEI" | p. 161 |
| Calculador Ec3 | , |
| "Calculador SBp1. Renovación de Aire Interior" | pp. 178–184 |
| "Herramienta de Verificación Confort Térmico Certificación CASA", also named "Calculador SBp3" | pp. 191–193 |
| CCCS "Protocolo de verificación para sistemas ingenieriles de ventilación natural en climas ecuatoriales" | pp. 178, 189 |
| Calculador SBc7 and Calculador SBc8 | pp. 209, 211 |
| Calculador Mc2 and Calculador Mc3 | , |
| CCCS "Herramienta de balance hídrico" in the "Guía para la gestión sostenible y circular del agua en edificaciones" | , |
| CCCS "Guía de contratación para estudios en bioclimática" | p. 34 |

The guide also points to external tools such as the CBE Thermal Comfort Tool.

**Published on `casa.cccs.org.co/calculadores/`.** The page lists 77 calculators: V1.1 (19), V2.1 (19), V3.0 (21) and V3.1 (18). It is a paged table that loads through `admin-ajax.php?action=tm_get_records`, and that endpoint returned **HTTP 403** to me. Only the first 10 rows (all V1.1) were readable. I inferred the 18 V3.1 IDs from the page's filter facet, so they are not confirmed:

> AP1, AP3, AP6, BEC2, BEC3, BEC4, CCRP1, CCRP3, CCRP4, EP1, EP3, GGP6, MC2, MC3, SBC7, SBC8, SBP1, SBP3

AP6, EP3 and CCRP4 probably mean Ac6, Ec3 and CCRc4. I could not read the names, the download links or the file formats.

**Documents page (`/documentos-y-herramientas/`).** It lists:

- CASA 3.1, with the transition note and a "Tabla de equivalencias 3.1" against LEED for Cities and Communities.
- CASA 3.0 (January 2026, plus the 2 Oct 2025 text without addenda).
- CASA 2.1, VIS 1.1, Vivienda Existente and Prototipos.
- Addenda 003 to 008. Adenda 008 (2 Dec 2025) is the one that aligned water and energy with Res. 0194.

---

## 2. Item-by-item: requirement, thresholds, evidence and feasibility

**Verdict key**

- `ready`: computable from fields the snapshot reads today.
- `needs-new-fields`: names the Revit categories or parameters to add.
- `needs-external`: weather, flood study, GIS, calculators or typed inputs.
- `manual`: documents or judgement.

Most items are mixed. The first verdict listed is the one that blocks.

**What the snapshot reads today**, checked in `lib/viewer/snapshot.ts`:

- **Categories:** Walls, Curtain Panels, Windows, Doors, Roofs, Floors, Rooms, Levels, Project Base Point, Generic Models, Mass.
- **Parameters:** Type Name, Level, Base Constraint, Phase Demolished, Area, Length, Width, Height, Rough Width, Rough Height, Base Offset, Elevation, Angle to True North, Function, Name. Glazing parameters: Heat Transfer Coefficient (U), Solar Heat Gain Coefficient, Visual Light Transmittance, Thermal Resistance (R), Analytic Construction. Reflectance parameters: SRI, Solar Reflectance Index, Solar Reflectance, Reflectance. Instance values are merged with type values, so the nominal door `Width` is already there.
- **Geometry:** façade geometry per wall, panel, window and door, room footprints, and a bbox for every element.
- **Derived:** room index with `gradeZ`, floor-to-floor per room (`byRoom`) and area-weighted, storey counts, WallEvidence (`azimuthPlusDeg`, `fPlus`) and OpeningEvidence (`azimuthDeg`, host wall).
- **Not read:** room Number, Department or Occupancy; any wall `Structural` flag; roof `Slope`; and the MEP, site, parking and planting categories.

### 2.1 The 14 items the hypothesis classed as "viewer"

#### GGp8 , Operational waste management (Gestión de residuos durante la operación). Prerequisite. pp. 47–52

- **Requirement.** Design and build a space for sorted storage of compostable organic, non-recyclable and recyclable waste. Size it for the expected volume, place it for easy collection, and meet local rules (Decreto 2981 de 2013).
- **Formula** (p. 48–49):
  - Vᵢ = (ppcᵢ / dᵢ) · nh · nd.
    - ppcᵢ: per-capita production in kg/person/day, from the municipal PGIRS and the socio-economic stratum.
    - dᵢ: density in kg/m³.
    - nh: inhabitants per dwelling = **number of bedrooms + 1**. CASA says this "debe ser constante en todos los cálculos que requieran la ocupación del proyecto".
    - nd: storage days.
  - Pick commercial bins for each volume.
  - Room area = A_org + A_nrec + A_rec + A_circulación.
- **Caution.** The worked example has arithmetic slips. It writes "0,855/2162" for a product, and says to multiply by density where its numbers divide. Implement the formula, not the example.
- **Evidence.**
  - Design: a sizing calculation, and PDF plans showing spaces for paper, plastic, metal, glass, cardboard and RAEE (electronic waste) bins, with signage.
  - Construction: date-stamped photos.
- **Verdict: `needs-new-fields` + `needs-external`.**
  - Ready: the waste room can be found by room `Name` (for example cuarto de basuras or residuos), and its area is read.
  - Missing: the bedroom count per dwelling needs a **unit key on rooms** (Revit Room `Number` prefix, `Department` or `Occupancy`, a shared "Unidad", or Revit **Areas** of type dwelling) plus a bedroom regex on `Name` (Alcoba, Habitación, Dormitorio).
  - External: ppc, density and storage days are typed or come from the PGIRS.

#### BEc2 , Local habitat preservation and regeneration (Preservación y regeneración del hábitat local). 4 pts. pp. 87–93

Options combine up to 4 points.

- **Option 1** (1–2 pts):
  - Case 1, lot less than 50% natural: restore **7% of the lot for 1 pt, 15% for 2**.
  - Case 2, lot 50% or more natural: conserve **12% or 25%** of the pre-development natural area.
  - Species must be native or adapted and provide ecosystem services.
- **Option 2**, green area per person (Table 18):

  | Points | Non-VIS | VIS |
  |---|---|---|
  | 1 | **8 m²/person** | **7 m²/person** |
  | 2 | **10 m²/person** | **9 m²/person** |

  - Vertical green counts at **0.5**.
  - Permanent green areas within 400 m walking distance count at 20%.
  - Species must be native or adapted, except in urban gardens.
- **Option 3** (1 pt): every exterior common-area luminaire is shielded so that no light is emitted "a un ángulo de 90° o más, desde el nadir".
- **Evidence.**
  - Restoration or conservation plan.
  - Technical document signed by a landscape architect, biologist or ecologist.
  - Area plan with the per-inhabitant calculation, and the species list.
  - Lighting plan with fixture details.
  - Construction: photos, fixture data sheets and night photos.
- **Verdict: `needs-new-fields` + `manual`.**
  - Green area needs the **Planting** and **Topography/Toposolid** categories (subregions or materials), green-roof types (Roofs or Floors whose type name matches a rule) and **Property Lines** for the lot area.
  - Occupants need the unit key and bedroom count.
  - Option 3 needs **Lighting Fixtures** outside the building with a cutoff or "full cutoff" type parameter.
  - Ecosystem value and species are manual.

#### BEc3 , Urban microclimate preservation (Preservación del microclima urbano). 2 pts. pp. 94–96 (missing from the table of contents)

- **Requirement.** At least **50%** of hardscape plus roofs gets one or more of these treatments. Hardscape and roofs mean all roofs of all project structures, internal roads, paths, playgrounds, parking, sidewalks and plazas. Treatments:
  - Tree shade at 10 years, averaged over 10:00, 12:00 and 15:00 at the summer solstice.
  - Shade from structures covered by solar or PV.
  - Shade structures with **SR > 0.33**.
  - Ground surfaces with **SR > 0.33**.
  - Open-grid paving with **50% or more open area**.
  - Green roofs.
  - Roofs with **SRI > 32 on steep slopes (more than 9.5°)** or **SRI > 64 on low slopes (9.5° or less)**.
- **Exclusions.** Areas with solar panels, equipment, skylights or water features are excluded.
- **Point split.** The worked example scores 1 point at 80% coverage. The text does not say how 1 point differs from 2.
- **Evidence.**
  - Heat island plan with shade projections and materials, and an area table.
  - Construction: data sheets and photos.
- **Verdict: `needs-new-fields` + `needs-external`.**
  - Ready: roof area and roof SRI parameters (the same as EEM02).
  - Missing: roof **`Slope`**, and hardscape surfaces (Toposolid subregions, Floors at grade, **Parking**) with an SR parameter.
  - External: tree shade needs a sun study.

#### Ap3 , Indoor water use reduction (Reducción del consumo de agua interior). Prerequisite. pp. 124–132

- **Requirement.** Fixtures must give "un ahorro acumulado respecto a la línea base definida por los consumos máximos establecidos por la NTC 1500", meeting Res. 0194 by climate zone.
- **Minimum savings (Table 27)**:

  | | Frío | Templado | Cálido seco | Cálido húmedo |
  |---|---|---|---|---|
  | Non-VIS | **25%** | **25%** | **20%** | **20%** |
  | VIS/VIP | **15%** | **15%** | **15%** | **15%** |

- **Scope.** The calculation covers dwellings and common areas.
- **Every fixture must stay at or under the NTC 1500 maximum (Table 28)**:

  | Fixture | Maximum |
  |---|---|
  | Lavamanos | **8.3 L/min at 60 psi** |
  | Ducha | **9.5 L/min at 80 psi** |
  | Grifería de cocina | **8.3 L/min at 60 psi** |
  | Orinal | **3.8 L per flush** |
  | Inodoro | **6 L per flush** |

- **Uses per person per day (Tables 29–30)**:
  - Residential: lavamanos 5 uses × 1 min, ducha 1 × 8 min, cocina 1 × 1 min, inodoro 5 uses.
  - Common areas: separate rates for employees and visitors.
  - Consumption = uses/day/person × duration × persons.
- **Special cases.**
  - VIS note: an undelivered second bathroom counts at baseline consumption, or 50% efficient if there is an outreach programme.
  - Projects that deliver no fixtures must reach the savings through other means and lose access to Ac5.
- **Evidence.**
  - Use groups, including the urinal access percentage.
  - Data sheets with flow and test pressure.
  - The CASA water calculator, completed.
  - Construction: data sheets of the fixtures actually installed.
- **Verdict: `needs-new-fields`.**
  - Add the **Plumbing Fixtures** category with shared or type parameters for flow (L/min), flush volume (L per flush) and test pressure (psi). Revit has no built-in L/min parameter on fixtures.
  - Occupants need the unit key and bedroom count.
  - Fixture type comes from family or type name rules (inodoro, lavamanos, ducha, lavaplatos, orinal).

#### Ec4 , Electrification (Electrificación). 1 pt. pp. 168–170

- **Non-VIS.** Only electricity is delivered to each dwelling, sized for all uses. Any provided cooking, water-heating or space-heating equipment is electric and labelled RETIQ A or B. Induction hobs are exempt from the label. This applies to dwellings and common areas, but not to emergency plants.
- **VIS.** Leave electrical points for future cooking and water heating, and explain them in the owner's manual (VSp1).
- **Evidence.** Electrical design with a typical-unit plan of the points. Non-VIS adds data sheets and photos; VIS adds the owner's manual section.
- **Verdict: `needs-new-fields` + `manual`.**
  - Add **Electrical Fixtures** (receptacles) located in kitchen and laundry rooms, and **Plumbing Fixtures / Mechanical Equipment** (heaters, cooktops) with a fuel or energy-source type parameter.
  - Gas could be detected through **Pipes** or **Piping Systems** with a gas system type.
  - RETIQ labels come from data sheets.

#### SBp1 , Indoor air quality (Calidad del aire interior). Prerequisite. pp. 172–184

Six areas are assessed separately.

1. **Dwellings**, both habitable and wet rooms.
   - Case A, prescriptive natural ventilation per ASHRAE 62.1-2016 §6.4: **useful opening area > 4% of the space's floor area**, with no obstruction. Casement windows count only their useful opening.
   - Case B: a ventilation model.
   - Case C: mechanical ventilation per ASHRAE 62.2-2016 §4 and §6.8. Table 45 gives cfm by floor area and number of bedrooms; for example, less than 47 m² with 1 bedroom needs **30 cfm**.
   - Every bathroom needs mechanical exhaust to the outside: **25 cfm continuous or 50 cfm intermittent**. Bathrooms on the façade with an extractor need no natural-ventilation check.
2. **Common areas** (not corridors or stairs): Case A at 4%, Case B, or Case C with ASHRAE 62.1 Table 6.2.2.1 rates (Rp, Ra; for example lobby 5 cfm/person + 0.65 cfm/m²).
3. **Kitchens**: natural ventilation at 4%, a model, or mechanical exhaust of **at least 50 cfm** to the outside. Recirculating hoods do not count.
4. **Gas heaters**: NTC 3631. Type B appliances are flued outside the thermal envelope.
5. **Enclosed parking**: renewal of the air, sealed doors to adjoining habitable spaces, and no operable openings into the parking.
6. **Open parking**: **at least 1.5 m** between the back line of the parking space and any window or grille.

- **Evidence.**
  - Descriptive memo and zoning plans.
  - Case A: dimensioned plans, sections and opening details showing the useful opening, plus the SBp1 calculator.
  - Case C: mechanical plans, data sheets and the calculator.
  - NTC 3631 compliance documents and parking plans.
  - Construction: final data sheets.
- **Verdict: `needs-new-fields`.**
  - Case A needs a **window operable or useful opening area**, or an opening type with a factor. This is a shared type parameter such as "Área de apertura útil (m²)" or "Fracción operable".
  - It also needs each window **associated with the room it serves**. The EEM01 opening probe already finds the room behind each opening; expose it.
  - Exhaust needs **Mechanical Equipment / Air Terminals** with an airflow parameter.
  - Parking needs the **Parking** category and plan distances to windows.

#### SBc2 , Advanced indoor air quality (Calidad avanzada del aire interior). pp. 185–187

- **Points.** The credit page says **3 points maximum, 4 for detached single-family houses**. The summary table says 4.
- **Strategies**, 1 point each:
  1. Natural-ventilation model of habitable rooms.
  2. Mechanical ventilation of habitable rooms.
  3. Mechanical extraction in wet rooms.
  4. Kitchen extraction in all kitchens.
  5. A CO alarm in every dwelling, with a sounder and mains power plus battery backup.
  6. No-combustion cooking.
  7. No-combustion heaters.
  8. Enclosed parking extraction per ASHRAE 62.1.
- **Evidence.** A memo. Strategies 1 to 4 reuse the SBp1 documents. Strategy 5 needs plans with sensor locations and data sheets. Strategies 6 and 7 need data sheets.
- **Verdict: `needs-new-fields`.**
  - Exhaust fans and air terminals per bathroom or kitchen, with airflow.
  - A CO detector family per unit (**Fire Alarm Devices / Security Devices**) plus the unit key.
  - Cooktop and heater energy source.
  - Strategy 1 is `needs-external`.

#### SBc5 , Acoustic comfort (Confort acústico). 2 pts (3 for detached single-family). pp. 198–201

- **Option 1** (1 pt): mechanical equipment at **LAeq 15 min of 38 dB or less inside dwellings** and **43 dB or less elsewhere**. A project with no mechanical equipment (meeting SBp1 and SBc4 passively) gets the point.
- **Option 2** (1–2 pts):
  - Separating walls and floor/ceiling assemblies between dwellings, or between a dwelling and common, service, stair or mechanical spaces: **STC 55 or more**.
  - Exterior windows of dwellings: **STC 34 or more**.
  - Dwelling entrance doors: **STC 30 or more**.
  - Floor/ceiling assemblies: **IIC 50 or more**.
  - Floors and ceilings only earn 1 pt; floors, ceilings, doors, façades and walls together earn 2.
- **Option 3** (1 pt): compliance with a binding local acoustic rule.
- **Evidence.** Equipment list with dB and data sheets, or an STC/IIC report with material data sheets, or regulatory compliance documents. Design phase only.
- **Verdict: `needs-new-fields`.**
  - **STC and IIC** type parameters on wall, floor, window and door types. These are usually shared or project parameters, not Revit built-ins; check against the model.
  - The **unit key**, to identify separating walls. The room probe already samples both sides of every wall: a wall with rooms of different units, or a unit and a common room, on each side is a separator.
  - Equipment dB values come from data sheets.

#### SBc6 , Interior lighting performance (Desempeño de la iluminación interior). 2 pts (4 for detached single-family). pp. 202–206

- **Option 1** (1 pt): non-VIS meets at least 3 of 7 items, VIS at least 1.
  - Illuminance: bedrooms 100–200 lux, closets 200–300, kitchen 200–500, bathrooms 100–200, study 300–500, stairs 100–200.
  - Contrast ratio of 10 or less.
  - Uniformity of **0.5 or more**.
  - Colour temperature constant within ±200 K, and **3500 K or less** in quiet rooms.
  - CRI of 90 or more, or 80 or more with R9 of 50 or more.
  - **UGR 16 or less**.
  - At least 3 scenes or levels.
- **Option 2** (1 pt):
  - Alternative 1: "El acristalamiento de la envolvente vertical debe ser mínimo el **15% del área del piso de cada unidad de vivienda**. La transmisión de luz visible (**VLT**) debe ser superior al **40%**".
  - Alternative 2, simulation: **100 lux on at least 90%** of each regularly occupied space, and **150–5000 lux on at least 50%** of the regularly occupied area. Computed at 9:00 and 15:00 on a clear equinox day, on a grid of 1.5 m or finer.
- **Evidence.** A report plus plans and an Excel calculation for Alternative 1, or a simulation report. Design phase only.
- **Verdict: `needs-new-fields`.**
  - Ready: glazing area and VLT (`Visual Light Transmittance`, already read for EEM09).
  - Missing: the **unit key**, to sum glazing and floor area per unit, and the window-to-unit association.
  - Option 1 is `manual` or a lighting calculation.

#### SBc7 , Healthy habits (Hábitos saludables). 2 pts. pp. 207–209

- **Baseline.** Comply with the national rules on tobacco smoke indoors. Multifamily projects install permanent walk-off mats at every main pedestrian entrance, as wide as the entrance.
- **Option 1** (1 pt): secure bicycle parking for at least **30% of dwellings**.
- **Option 2** (1 pt): physical-activity space for simultaneous use by **10% of residents (non-VIS) or 5% (VIS)**.
- **Option 3** (1 pt): no smoking in exterior common areas, written into the property regulation. Any smoking area must be **more than 7.5 m** from dwellings, play areas and social or activity spaces.
- **Evidence.** Mat plan, bike plans (as in BEc4), activity-space plans with the capacity calculation, signage plans, and photos.
- **Verdict: `needs-new-fields` + `manual`.**
  - Bike racks from **Parking** or **Specialty Equipment** family names.
  - Room capacity needs an occupant-load parameter on activity rooms.
  - The dwelling count needs the unit key.
  - Mats and regulations are manual.

#### SBc8 , Social interaction (Interacción social). 1 pt. pp. 210–211

- **Requirement.** Free common spaces holding **10% (non-VIS) or 5% (VIS)** of residents at the same time. Each space holds **at least 4 people**, is comfortable for 1 hour or more, suits all ages and is free to use.
- **Evidence.** A report, plans with the capacity calculation, and photos.
- **Verdict: `needs-new-fields`.**
  - Social rooms or areas by name, with a **capacity** or occupant-load parameter.
  - Residents = Σ(bedrooms + 1), which needs the unit key.
  - Outdoor spaces need site elements or Areas.

#### SBp9 , Universal access to the project (Acceso universal al proyecto). Prerequisite. pp. 212–214

- **Scope.** All main entrances of multifamily projects, including gatehouses and separate buildings.
- **Requirements.**
  - Firm, stable, non-slip surface.
  - Abrupt level changes no greater than **6.4 mm**. Changes from 6.4 to 13 mm must be bevelled no steeper than 1:2.
  - Clear width **0.80 m or more**. With double-leaf doors, at least one leaf gives 0.80 m.
  - **Ø 1.20 m** clear space on both sides of the door.
  - **0.30 m or more** from the handle to the corner.
  - A **Ø 1.50 m** turning space before the entrance, in front of accessible lifts, and in enclosed corridors at most every **10 m**.
  - Gaps in the surface no greater than **1 cm**.
  - Ramps "cumplir con lo dispuesto en el capítulo 405 del ADA". CASA itself gives **no slope number**. ADA 2010 §405 gives a running slope of 1:12 (8.33%) maximum, a cross slope of 1:48, a clear width of 36 in (915 mm), a rise of 30 in (760 mm) maximum per run and landings of 60 in (1525 mm). These are ADA values, not CASA's; verify them before encoding.
  - The worked example uses a 2% ramp, 1.50 m wide, 7 m long, with handrails at 0.90 m.
- **Evidence.**
  - Design: plans and details of the accessible entrances.
  - Construction: photos showing dimensions, slopes and materials.
- **Verdict: `needs-new-fields`.**
  - Ready: the nominal door `Width` and `Function = Exterior`, and door bboxes.
  - Clear width needs a shared "Ancho libre" parameter or a frame deduction.
  - Add the **Ramps** category (type `Ramp Max Slope` or geometry) and a main-entrance flag on doors.
  - Turning circles could be tested approximately against room footprints.
  - Surfaces and level changes are `manual` (photos).

#### SBc10 , Advanced universal access (Acceso universal avanzado). 1 pt. pp. 215–217

- **Requirement.** All common areas meet SBp9, plus **2 or more** of these:
  - Refuge areas (ABA Guide, chapter 4).
  - An accessible toilet in each common area that has toilets.
  - Tactile or visual marking on full-height glass.
  - Easy-grip window and door hardware.
  - Single-lever taps.
  - Rocker or hands-free switches.
  - Motion-sensor lighting.
  - Knee space under built-in counters.
  - A **0.90 m** clear width at all entrances.
  - Contrasting stair nosings.
- **Scope.** Not applicable to single-family houses.
- **Evidence.** Plans, details and photos.
- **Verdict: `needs-new-fields` + `manual`.**
  - Door widths in common areas need a common-area room tag and clear width.
  - Accessible toilet families come from **Plumbing Fixtures** names.
  - The rest is specification.

#### Mc4 , Circularity (Circularidad). 2 pts. pp. 236–239

- **Requirement.** Use at least 2 of these alternatives:
  - **(a)** Prefabricated interior partitions (**more than 50% of wall area**) or a demountable structure.
  - **(b)** "la mayoría de las particiones interiores no sean estructurales (**>50% en área de muros**)", plus "una altura entre placas de mínimo **2,40 m**", plus spaces that can change use.
  - **(c)** At least 20 years of expected life for floors, ceilings, kitchen and bathroom furniture, and windows.
  - **(d)** 100% of finishes free of formaldehyde, phthalates, PFAS, heavy metals and isocyanates.
- **Ambiguity.** "Altura entre placas" most likely means slab-to-slab, which is floor-to-floor. The MS&C form separately asks for "Altura piso a techo" and "Altura libre entre losas". Confirm with CCCS.
- **Evidence.**
  - Structural plans showing the partitions and the share by area.
  - Sections showing heights, and adaptation diagrams.
  - Supplier declarations.
  - The owner's manual section.
- **Verdict: `needs-new-fields`.**
  - Ready: interior wall area (role `interior-wall`, `area`) and floor-to-floor per room (`ff.byRoom`). Use the **minimum over dwelling rooms**, not the area-weighted average.
  - Missing: the wall **`Structural`** instance parameter (Yes/No) or **`Structural Usage`**, plus a prefabricated flag (a type parameter, or a name rule such as drywall or superboard confirmed through greenr's classification loop).
  - (c) and (d) are `manual`.

### 2.2 Model-relevant "app" items

#### GGc5 , Bioclimatic study (Estudio bioclimático). 3 pts, design phase. pp. 30–34

- **Minimum components.**
  - Climate characterisation: monthly mean temperature, mean daily maximum and minimum per month, and relative humidity.
  - Solar radiation "en las **4 fachadas principales** y de la cubierta".
  - Shading on the 4 main façades.
  - Wind direction and speed, with cross and stack ventilation recommendations.
  - Orientation, justified with the sun path.
  - Daylight access, including the critical dwelling units.
  - Thermal comfort.
  - "Relación ventana/muro (v/m) ... Cómo mínimo se espera que se recomienden las relaciones v/m de **cada una de las fachadas principales**", with solar control strategies.
- **Depth required by typology.**
  - Level 1, descriptive: single-family.
  - Level 2, monthly or seasonal analysis with recommendations per façade: **multifamily VIS**.
  - Level 3, hourly data, quantitative comfort and simulation: multifamily non-VIS and complex projects.
- **Failure rule.** Missing any component fails the credit. The study must show that it changed the design.
- **Evidence.** A study report (inputs, method, tools), a report of implemented and rejected measures, and a report linking the optimisations to CASA credits.
- **Verdict: `needs-external`.**
  - **WWR per façade is `ready`**: re-bin the EEM01 wall and opening evidence into 4 orientations (see §4).
  - Roof area is ready.
  - Climate, radiation, shading, wind and comfort need weather data (EPW or IDEAM) and simulation.

#### CCRp3 , Project resilience (Resiliencia del proyecto). Prerequisite. pp. 68–71

- **Option 1, risk diagnosis.**
  - Hazards: chronic (water stress, heavy rainfall, extreme heat) and acute (floods, strong winds, torrential flows or landslides, wildfire).
  - Rate each hazard NA, Bajo, Medio, Alto or Muy alto, using the CCRp3 tool and official maps (UNGRD atlas, IDEAM, IGAC, ThinkHazard, IDIGER and others).
  - High or Very High ratings require mitigation measures.
- **Minimum measures to validate (Table 12).**
  - **Inundación**: "Piso ocupado (habitable) más bajo igual o superior a la **rasante de la vía**. Para proyectos que se encuentran dentro de la llanura de inundación de un cuerpo de agua, se debe determinar la altura mínima en base a un estudio para un **periodo de retorno de 100 años**." High or Very High risk requires a detailed mitigation study.
  - Wind: NSR-10 wind zoning.
  - Fire: RETIE and NSR-10 Title J.
  - Landslides: a mass-movement certificate from the competent authority.
  - Earthquake: NSR-10.
- **Option 2.** Meet CCRc4 Option 2.
- **Who it applies to.** All projects. The 100-year study applies only to sites in the floodplain of a water body.
- **Evidence.**
  - Design: the analysis document (tool) and a checklist of minimum measures signed by the project director or manager.
  - Construction: O&M recommendations in the VSp1 owner's manual, with page numbers.
- **Verdict: `needs-external`.**
  - External: road grade elevation ("rasante"), the flood elevation if in a floodplain, and hazard maps, all typed or linked.
  - Ready: the lowest habitable room floor elevation, from room `zmin` with habitable filtering by `Name`, and the room index `gradeZ`.
  - The hazard ratings and code checklist are `manual`.

#### CCRc4 , Improved project resilience (Mejora en la resiliencia del proyecto). 5–20 pts. pp. 72–82

- **Option 1, adaptation measures.**
  - Path 1: prioritise 2 or more hazards, with at least 1 measure each. **2 measures earn 3 pts (level D); 4 measures earn 5 pts (level C).**
  - Path 2, if BEc1 is achieved: **1 measure earns 3 pts; 3 measures across 2 hazards earn 5 pts**.
- **Flood measures that a model can check** (Table 15, p. 76). Each threshold is the flood elevation "calculada para un periodo de retorno de **50 años** (**100 años** si el proyecto está en la llanura de inundación de un cuerpo de agua)". The measures are:
  - The building entry level is above that elevation.
  - All habitable spaces are above it.
  - No water-sensitive machinery is below it.
  - There are no openings or entry points below it.

  The evidence for each is a topographic survey with the flood-elevation analysis, plus a project elevation plan.
- **Other measures** draw on other credits: Ac2, Ac5, Ac6, SBc2, SBc4, BEc3, Ec2, Ec3, solar control with GGc5, and backup power for 12 hours.
- **Option 2, pilot.**
  - Hazards modelled for 2050 under SSP2-RCP4.5.
  - **Mejorado earns 9 pts (B), Robusto 14 (A), Superior 19 (AA)**, plus 1 point with a community measure (B+, A+, AA+).
  - Needs independent peer-review letters and a reviewer with 10 years' experience or more.
- **Verdict: `needs-external` + `needs-new-fields`.**
  - External: the flood elevation and return period, typed with their datum.
  - Ready: rooms (`zmin`) and window and door sills (bbox `zmin`) against that elevation.
  - Missing for the equipment measure: **Mechanical Equipment** and **Electrical Equipment** categories.
  - Option 2 is external and manual.

#### Ap1 , Rainwater management (Gestión del agua lluvia). Prerequisite. pp. 108–116

- **Cases.** Case 1: the lot is partly urbanised or undeveloped. Case 2: 90% or more of the lot is hard or impermeable.
- **Option 1**, manage on site the daily rainfall percentile:

  | | Case 1 | Case 2 |
  |---|---|---|
  | Non-VIS | **P30** | **P20** |
  | VIS | **P20** | **P10** |

  - The percentile comes from at least 10 years of daily records, after discarding events under 2.5 mm.
  - **V = A · Ci · P**: A is the lot area in m², Ci is the area-weighted runoff coefficient from RAS 2016 Title D Table D.4.7, and P is in mm.
  - Coefficients include **roofs 0.9**, asphalt or concrete 0.9, pavers 0.85, multifamily blocks with hardscape 0.75, and parks 0.3.
  - Worked example: 17,979 m² × 0.66 × 5.10 mm = 60.52 m³.
- **Option 2**, reduce the design-storm peak flow:

  | | Case 1 | Case 2 |
  |---|---|---|
  | Non-VIS | **35%** | **15%** |
  | VIS | **30%** | **10%** |

  The return period comes from Table 23, ranging from 3 to 100 years by drainage area.
- **Local rules.** Stricter local requirements prevail.
- **Evidence.**
  - Case justification and the pre-development plan.
  - Volume and SUDS calculations, and plans.
  - Construction: photos, record drawings and O&M notes.
- **Verdict: `needs-external`.**
  - External: the IDEAM rainfall percentile, and the SUDS design.
  - Ready: **roof area** (`D-ROOF`) gives the C = 0.9 share.
  - Missing for the other surfaces: site surfaces (Toposolid subregions, Floors at grade, Parking, Planting), and the lot area (**Property Lines**) or a typed value.

#### Ep1 , Energy efficiency (Eficiencia energética). Prerequisite. pp. 151–159

- **Option 1**, ASHRAE 90.1-2016 Appendix G through the CASA modelling protocol:
  - % saving = 1 − PCI/PCIt.
  - PCI = proposed EUI / baseline EUI.
  - **PCIt = (BBUEC + FDE·BBREC) / BBP**, where FDE is the Colombian factor (Table 39), not ASHRAE's.
- **Minimum savings (Table 38)** and **FDE (Table 39)**, by climate zone:

  | Typology | Min. % (Frío / Templado / Cálido seco / Cálido húmedo) | FDE (same order) |
  |---|---|---|
  | No VIS Multifamiliar | 18 / 23 / 23 / 23 | 1.22 / 1.13 / 1.20 / 1.21 |
  | No VIS Unifamiliar | 18 / 23 / 23 / 23 | 1.64 / 1.16 / 1.38 / 1.48 |
  | VIS Multifamiliar | **13 / 13 / 13 / 13** | 1.21 / 1.23 / 1.24 / 1.19 |
  | VIS Unifamiliar | 18 / 18 / 18 / 18 | 1.68 / 1.38 / 1.19 / 1.48 |
  | VIP Multifamiliar | 8 / 13 / 13 / 13 | 1.12 / 1.11 / 1.25 / 1.22 |
  | VIP Unifamiliar | 13 / 18 / 18 / 18 | 1.78 / 1.23 / 1.16 / 1.38 |

  Tables 38 and 39 are images in the PDF; I read them from a 200 dpi render. Adenda 008 and Adenda 01 restate the same values.
- **Option 2**, prescriptive, through "Ep1_CASA_Calculador prescriptivo".
  - Systems: envelope (roof, walls above and below grade, floors, slabs, doors, vertical and horizontal glazing), HVAC, hot water, electrical equipment, lighting and other equipment.
  - **Envelope scope:** "corresponden a aquellos que colindan directamente con las unidades residenciales. No se deben analizar elementos de envolvente de zonas comunes, puntos fijos, corredores".
- **Evidence.**
  - A project description that includes the climate zone.
  - Option 1: the model report, the performance calculator, and the PCI/PCIt calculation showing BBUEC, BBREC, BBP and the chosen FDE.
  - Option 2: the prescriptive calculator, plans and data sheets.
  - Construction: final data sheets.
- **Verdict: `needs-external`.**
  - External: the calculator or the simulation.
  - Partly ready: envelope areas per element from EEM01 and D-ROOF, and glazing U and SHGC.
  - Missing: a **unit vs common-area tag on rooms**, to keep only the envelope that adjoins dwellings, and opaque U values (`Heat Transfer Coefficient (U)` is read but usually empty or zero, as EEM09 already reports).
  - I could not obtain the calculator to map its exact input cells.

#### Ec2 , Improved energy efficiency (Eficiencia energética mejorada). 9 or 10 pts. pp. 160–164

- **Option 1**, additional saving over the Ep1 minimum (Table 40):

  | Additional saving | Points |
  |---|---|
  | Ep1 minimum | 2 |
  | +5% | 4 |
  | +10% | 5 |
  | +15% | 7 |
  | +20% | 9 |
  | +25% | 10 |

  GHG savings of 15%, 20%, 25% and 30% earn 1 to 4 points in **CCRc2**. Exemplary performance is 40% additional.
- **Option 2**, prescriptive, up to 9 pts (Table 42). Points per system:

  | System | Frío | Templado | Cálido seco | Cálido húmedo |
  |---|---|---|---|---|
  | Envolvente | 3 | 3 | 4 | 4 |
  | HVAC | 1 | 1 | 1 | 2 |
  | Agua caliente | 3 | 2 | 1 | 1 |
  | Iluminación | 1 | 2 | 2 | 1 |
  | Otros equipos | 1 | 1 | 1 | 1 |

  What each system requires:
  - Envelope: improve **2 of 6** categories, counting only elements that adjoin dwellings.
  - Lighting: interior **LPD 30% or more below ASHRAE 90.1-2016 §9**, and exterior tradable surfaces 30% lower.
  - Water heaters: Et 10% better than ASHRAE Table 7.8.
  - HVAC: none needed (comfort proven), or 10% better than Tables 6.8.1-1 to 6.8.1-16.
  - Other equipment: RETIQ A or B appliances in 3 or more categories.
- **Verdict: `needs-new-fields` + `needs-external`.**
  - LPD needs **Lighting Fixtures** with wattage (`Apparent Load` or a shared Watts parameter), associated to rooms, plus room areas (ready).
  - The envelope part is the same as Ep1.
  - Equipment comes from data sheets.
  - Option 1 needs simulation.

#### SBp3 , Thermal performance (Desempeño térmico). Prerequisite, design phase. pp. 188–193

- **Requirement.** All regularly occupied spaces meet ASHRAE 55-2019 or NTC 5316 at **80% acceptability**, for **at least 75% of daily time (non-VIS)** or **60% (VIS)**.
- **Option 1, prescriptive.** Adaptive or PMV method, checked at least at 0:00, 3:00, 6:00, 9:00, 12:00, 15:00, 18:00 and 21:00. The CBE tool is recommended, and the CASA comfort verification tool is mandatory.
- **Option 2.** Dynamic simulation through the CCCS natural-ventilation protocol.
- **Evidence.**
  - A climate analysis.
  - A Givoni or Olgyay chart.
  - **An envelope description:**
    - Opaque elements: thickness, reflectance, U (W/m²K) and emittance.
    - Translucent elements: frame material, U, SHGC and VLT.
    - "un cálculo de la **relación muro / ventana para cada una de las orientaciones** de la edificación".
  - The method and comfort range, and the comfort reports.
- **Verdict: `needs-external`.**
  - External: climate data and the comfort tool or simulation.
  - The envelope table is mostly ready: WWR per orientation, glazing U, SHGC and VT, and wall thickness (`facade.thickness`).
  - Missing: opaque reflectance and emittance as new type parameters, and opaque U where it is not modelled.

---

## 3. Resolución 0194 de 2025 (Minvivienda)

Sources:

- The full text, `minvivienda.gov.co/sites/default/files/normativa/0194-2025.pdf`. It is a scan of 15 pages with an OCR text layer; I checked the tables against a render of the page.
- The ABC.
- Annexes 2 and 3.
- Adendas 01 and 02 to the homologation concept.

### 3.1 What it requires

- **Object.** Mandatory minimum water and energy savings for new buildings, plus a sustainable construction guide (Anexo 1). It replaces Res. 0549 de 2015 (Art. 1, Art. 15).
- **Dates.** Signed 11 Apr 2025. Published in Diario Oficial 53.097 on 23 Apr 2025. In force from 24 Apr 2025 (ABC §7).
- **Scope.** New-build construction licences ("obra nueva") filed after it entered into force. Licences already in process stay under Res. 0549. Mixed-use projects follow the majority use (Art. 2 note 3; ABC §6).
- **Phase-in (Art. 3).**

  | Months after entry into force | Date | Who becomes subject |
  |---|---|---|
  | (a) 6 | **24 Oct 2025** | All uses except VIS/VIP, in all municipalities |
  | (b) 12 | **24 Apr 2026** | VIS/VIP in category Especial, 1 and 2 municipalities, project **5,000 m² or more** |
  | (c) 18 | **24 Oct 2026** | Same categories, project **2,000 m² or more** |
  | (d) 24 | **24 Apr 2027** | VIS/VIP in the other municipality categories, project **5,000 m² or more** |

  The article does not say when smaller VIS/VIP projects become subject. The ABC graphic on p. 5 seems to highlight every area band at 24 months, but it is ambiguous; the article text governs.
- **MS&C (Arts. 8–9).** Mandatory **one year after** each group's savings start: 24 Oct 2026, 24 Apr 2027, 24 Oct 2027 and 24 Apr 2028.
- **Minimum savings (Art. 6)**, residential rows (percent):

  | | Energy: Frío / Templado / Cálido seco / Cálido húmedo | Water: Frío / Templado / Cálido seco / Cálido húmedo |
  |---|---|---|
  | No VIS unifamiliar | 15 / 20 / 20 / 20 | 25 / 25 / 20 / 20 |
  | No VIS multifamiliar | 15 / 20 / 20 / 20 | 25 / 25 / 20 / 20 |
  | VIS unifamiliar | 15 / 15 / 15 / 15 | 15 / 15 / 15 / 15 |
  | VIS multifamiliar | **10 / 10 / 10 / 10** | **15 / 15 / 15 / 15** |
  | VIP unifamiliar | 10 / 15 / 15 / 15 | 15 / 15 / 15 / 15 |
  | VIP multifamiliar | 5 / 10 / 10 / 10 | 15 / 15 / 15 / 15 |

  CASA's water targets equal these. **CASA's energy targets are 3 points higher**: for example VIS multifamiliar is 13% in CASA against 10% in the resolution. The homologation found CASA's targets "iguales o superiores".
- **2020 baselines (Art. 6 paragraph 2).**
  - Energy in kWh/m²·yr. For example VIS multifamiliar is 93.7 / 77.7 / 86.7 / 111.2 and No VIS multifamiliar 84.4 / 83.8 / 81.5 / 81.2.
  - Water is **155.8 L/person/day for every residential typology and zone**.
- **Climate zone (Art. 5; Anexo 2).**
  - Anexo 2 lists every municipality (DIVIPOLA code) with **one row per climate zone it contains and that zone's area in m²**. The zones are Frío, Templado, Cálido seco and Cálido húmedo; Cálido húmedo means mean relative humidity above 75%.
  - I parsed 2,208 rows covering 1,121 municipalities. **735 municipalities span more than one zone.** For example:
    - Medellín: Frío and Templado.
    - Cali: all four zones.
    - Bucaramanga: Templado and Cálido húmedo.
    - Bogotá: Frío only.
  - For a multi-zone municipality the exact site must be located with Minvivienda's shapefile (`clasificacion-climatica-1.zip`, `-2.zip`) or the geovisor (ABC §18).
  - If the plot lies in a different zone from the one assigned, the builder says so in the FUN (Art. 5 paragraph 2).
- **Certification of the measures (Art. 7).**
  - Passive measures: the designer's signature on the architectural plans counts as a sworn certification.
  - Active measures: a **self-declaration** ("autodeclaración") filed with the utility together with the network designs. It cannot be made a condition for approval.
  - Paragraph 1: the applicant **declares the active, passive or mixed measures in the Formulario Único Nacional (FUN)** and its sustainable construction annex.
  - The ABC (§11) says the current FUN already captures everything required.
- **Reporting (Arts. 10–11).** Curadores send FUN copies to Minvivienda every quarter. Utilities send the self-declarations every six months. Municipalities send the final compliance result every quarter, "con la aplicación del mecanismo de seguimiento o del sello debidamente homologado".
- **Sanctions.** The resolution creates none (ABC §16). Enforcement rests on the sworn declarations and the licensing process.
- **Tools published by Minvivienda** (`minvivienda.gov.co/normativa/resolucion-0194-2025`):
  - Anexo 1, the sustainable construction guide.
  - Anexo 2, climate information by municipality.
  - Anexo 3, the MS&C, with a downloadable Excel macro (`macro-mecanismo-de-seguimiento-y-control.xlsm`).
  - `calculador-agua.xlsx`.
  - The climate shapefile and its instructions.
  - A climate geovisor.

### 3.2 What the MS&C form asks for (Anexo 3)

The MS&C form is the municipal check that a CASA certificate can replace.

- **Section 1, general.** Typology, climate zone, address, total built area **excluding parking**, sellable area, parking area, start and end years, and expected occupants.
- **Section 2, materials and form.**
  - External and internal wall material (picked from a list) and approximate wall U.
  - Roof material and approximate roof U.
  - **"Relación ventana/pared (%)": Fachada Norte, Sur, Oriente, Occidente.** "Si su edificio está orientado en una dirección inexacta, ej. Nor-Oriente, simplifique el valor de relación ventana/pared al indicar en una única orientación."
  - Building form, total building height, floor-to-ceiling height, clear height between slabs, number of floors, building footprint, average window height and window type.
  - Shading devices: brise-soleil, blinds, balconies.
- **Section 3, measures.**
  - Passive: glass U and SHGC, vertical, horizontal or combined shading angles, green roof, thermal mass, night flush, WWR, wall SR, roof SRI, and roof and wall U.
  - Active: solar hot water, PV, LPD, sensors and so on.
  - Water: fixture consumption in L per flush or L/min.
- **Five stages.** The builder requests verification. The municipality fills in the MS&C, does a desk check, visits the site and issues the result.

### 3.3 How CASA is homologated as proof

- **Legal basis: Art. 7 paragraphs 4 and 5.** "Para la verificación de las medidas de ahorro de agua y energía **en fase de construcción**, se podrán considerar los sellos o certificados verdes ... previo a la homologación ... por el Ministerio". Minvivienda has 6 months from the scheme operator's request.
- **Base concept.** Radicado **2025EE0076418, 24 Nov 2025**, recognises CASA V3 as an "**mecanismo alterno de verificación frente al MS&C**". The technical evaluation ran from 25 Jun to 24 Nov 2025. It covered 6 typologies × 4 zones = 24 combinations, checked energy through the ASHRAE 90.1 App. G PRM with EUI, PCI and PCIt, and compared water against the Anexo 1 baselines. CASA's minimums were found equal to or higher than the resolution's. I did not find the base concept itself published; it is described in both addenda.
- **Adenda 01** (June 2026; Minvivienda's official reply 23 Jun 2026). It extends the equivalence to CASA V1.1 and V2.1 projects that adopt CCCS **Adenda 008** (2 Dec 2025) in full. Adenda 008:
  - Recalibrates the kitchen-tap uses.
  - Sets the water minimums by zone.
  - Replaces the FDE table.
  - Restates the energy minimums as % energy saving instead of cost or GHG.

  Certificates must name the climate zone, the typology, Adenda 008 and compliance with the minimum percentages.
- **Adenda 02** (August 2026; Minvivienda's official reply 6 Aug 2026; `minvivienda.gov.co/sites/default/files/documentos/adenda-02-concepto-homologacion-casa-3.1-vf.pdf`). It recognises **V3.1 as an update of the homologated V3**. The only changes it reviewed are Ap3 and Ep1. Projects must use the V3.1 calculators and protocols and the Res. 0194 parameters, and keep the independent third-party verification. "No constituye una nueva homologación".
- **What a certificate replaces.** It replaces the **construction-phase MS&C verification**. It does **not** replace the licence-stage FUN declaration, the designer's sworn signature or the self-declaration to the utility.

### 3.4 What a BIM pre-check could prepare for Res. 0194

1. **An "Anexo de construcción sostenible" / MS&C §2 sheet** straight from the model:
   - WWR for N, S, Oriente and Occidente, snapping each façade to one cardinal direction.
   - Building footprint (`storeys.footprintM2`), total height (levels or bboxes) and number of floors.
   - Floor-to-floor and clear height per storey.
   - Built area excluding parking: the sum of floor slabs minus parking rooms, or Revit Areas.
   - Wall and roof types with their materials and any U or SR/SRI values found, and window types with U and SHGC.
   - Shading devices: greenr already classifies the `shading` role on Generic Models.
2. **Applicability helper.**
   - Inputs: typology, municipality (DIVIPOLA), municipality category, climate zone and project area.
   - Outputs: which Art. 3 date applies, the targets, and when the MS&C becomes mandatory.
3. **Fixture schedule** checked against NTC 1500 (feeds both MS&C §3.2 and CASA Ap3).
4. **Flags** where the model cannot prove a declared passive measure, for example a WWR claim without a glazing type U value.

Present this as **inputs only, with no pass or fail**, the same stance greenr takes with EDGE. The legal declaration stays with the signing designer.

---

## 4. Overlap with EDGE (what greenr already produces)

| greenr output | CASA / Res. 0194 use | Difference to handle |
|---|---|---|
| EEM01 WWR per orientation, with gross façade = walls + windows + doors | GGc5 (WWR per main façade), SBp3 (WWR per orientation), MS&C §2.4 (N/S/E/W), and GGc5 Level 2 recommendations per façade | **EDGE uses 8 sectors of 45°; CASA and MS&C use 4 cardinal façades.** Do not sum the 8 bins: NE splits between N and E. Re-bin from `WallEvidence.azimuthPlusDeg`/`fPlus` and `OpeningEvidence.azimuthDeg` with a 90° sector function (keep EDGE's tie rule: an exact 45° edge goes to the clockwise sector), relative to true north. |
| EEM01 "frames count as glazing" | GGc5: "fracción del área total del muro que es superficie acristalada"; MS&C: "ventanas u otras superficies vidriadas dividida por la superficie bruta de la pared externa"; SBc6: "acristalamiento ... 15% del área del piso" | CASA never says whether frames count. Keep the EDGE convention, label it in the export, and flag it for the auditor. |
| EEM09 glazing U, SHGC, VT and the gaps list | SBp3 envelope table, SBc6 (VLT above 40%), Ep1/Ec2 prescriptive glazing, MS&C glass U and SHGC | Same parameters. The CASA gap points to the SBp3 or Ep1 page. |
| EEM02 roof SRI gaps | BEc3 (SRI above 32 or above 64 depending on 9.5° slope), MS&C roof SRI | CASA needs roof **slope**, a parameter not read today, and splits at 9.5°. EDGE does not split. |
| D-ROOF aggregate roof area | Ap1 (roofs at C = 0.9), BEc3 roof share, Ep1 roof element | Ap1 needs the lot area and the other surface types. Under Ep1 only roofs over dwellings count. |
| D-F2F floor-to-floor, area-weighted, plus `byRoom` | Mc4 ("altura entre placas" of 2.40 m or more), MS&C heights | Mc4 needs the **minimum** over dwellings, not the average. The MS&C asks separately for floor-to-ceiling and clear height between slabs. |
| D-FLOORS above and below grade (EDGE 50% rule) | MS&C "Número de pisos", CCRp3 (no habitable floor below road grade) | CASA compares against **road grade**, a typed value, not the ground around the building. |
| D-GIA (IPMS 2 GIA from rooms) | Ep1 EUI area (whatever the protocol defines; not read), MS&C built area excluding parking, BEc2/SBc8 occupants | The rooms sum is net of walls. Built area needs slabs or Revit Areas. Occupants need bedrooms per unit. |
| EEM01 envelope scope (all exterior walls, after exclusions) | Ep1 option 2: "solo elementos que colindan con unidades residenciales" | Needs rooms tagged as unit or common area, and then a filter on wall evidence by the adjacent room. |
| Units | , | CASA uses SI, except SBp1 ventilation rates in **cfm** (Rp in cfm/person, Ra in cfm/m²), NTC 1500 test pressures in **psi**, and ADA ramp rules in **inches**. |
| Climate | EDGE uses its own city weather | CASA and Res. 0194 use 4 zones per Anexo 2, which may vary inside a municipality. |
| Guide references | `GuideRef.part` is the EDGE part 1–8 | CASA references are a credit code plus a page in a single PDF. The export copy ("Inputs for the EDGE App", "EDGE V3.1 User Guide Part …", `DISCLAIMER`) and `RunResult.guideVersion: 'V3.1'` are hard-wired to EDGE. |

**Language risk (unverified).** greenr matches parameter display names in English: `Function`, `Area`, `Width`, `Type Name`, and categories such as "Revit Walls". Colombian models are often authored in Spanish Revit. I did not check whether the APS property database exposes localised names such as Función, Área or Anchura for those models. The classification regexes are also English-only (glass, window, curtain, skylight); they need Spanish equivalents such as vidrio, ventana, muro cortina and claraboya. Test one Spanish model before any CASA work.

---

## 5. Recommended first slice ("weekend" scope)

The ranking weighs value to a Colombian VIS developer against build cost. The value case is that Res. 0194 now binds VIS projects of 2,000 m² or more in category E, 1 and 2 municipalities (24 Oct 2026). The FUN declaration and the MS&C or CASA verification are not optional for them, while CASA points are.

**Architecture prerequisite (about half a day):**

- Add `scheme: 'EDGE' | 'CASA'` to the measure registry. Make `MeasureCode` scheme-scoped, or add `C-*` codes.
- Generalise `GuideRef` to `{ doc, page, title, url }` and point it at the CASA PDF, Minvivienda PDFs and so on.
- Parameterise the EDGE strings in `lib/export/pdf.ts` and `manifest.ts`.
- Add project inputs:
  - `typology`: No VIS, VIS or VIP, unifamiliar or multifamiliar.
  - `municipality` (DIVIPOLA code, typed).
  - `municipalityCategory` (E, 1–6).
  - `climateZone`: Frío, Templado, Cálido seco or Cálido húmedo. The user picks it; if the municipality has several zones, show a link to Anexo 2 and the geovisor.
  - `projectAreaM2`, prefilled from the model.

| Rank | Measure | Computes | New snapshot fields | User types | Value / cost |
|---|---|---|---|---|---|
| 1 | **C-ENV: envelope sheet for MS&C §2, GGc5, SBp3 and Ep1** | WWR for N/S/E/W from the re-binned EEM01 evidence; gross façade and glazing per cardinal direction; roof area; footprint; floors; total height; floor-to-floor min and average; glazing U, SHGC and VT per type; wall and roof types with any U or SR/SRI; count of shading devices. Export a CSV in MS&C field order. | None required. Optional: room `Department` or `Occupancy` to exclude parking from built area. | Typology and climate zone (for labels and targets only) | High / low. Reuses `tallyFacade`; only the binning function and a measure are new. |
| 2 | **C-FLOOD: CCRp3 minimum measure + CCRc4 flood measures** | Lowest habitable room floor vs road grade; every habitable room, window and door sill below the flood elevation; entry door level vs flood elevation. Lists the elements, with no verdict. | None. Room `Name` for the habitable regex, room `zmin`, opening bbox `zmin` and levels are read today. Optional for the 4th measure: **Mechanical/Electrical Equipment**. | **Road grade elevation ("rasante", m)**, **flood elevation (m)** with **return period (50 / 100 yr)** and **"in floodplain" yes/no**, and the **datum offset** between the survey and project base point elevation | Medium-high / low. Documents a prerequisite and up to 3 of the measures that earn 3–5 pts. |
| 3 | **C-VENT: SBp1 Case A (4% useful opening) + SBc6 Option 2 Alternative 1 (15% glazing per unit, VLT above 40%)** | Per room: useful opening area divided by floor area. Per unit: glazing area divided by unit floor area, plus VLT gaps. | Window **operable / useful-opening area** (shared type parameter) or an opening-type factor; the **room→opening association** (expose the EEM01 opening probe's room); a **unit key** (room `Number` prefix, `Department`, a shared "Unidad", or **Revit Areas**). | Which rooms are habitable or wet (defaulted from a `Name` regex, confirmed in the review UI) | High / medium. Natural ventilation is the common VIS path for a prerequisite, and SBc6 is 1 pt. |
| 4 | **C-WATER: Ap3 NTC 1500 caps + savings estimate** | Each fixture's flow or flush against the caps (8.3 / 9.5 / 8.3 L/min; 6 / 3.8 L per flush); occupants = Σ(bedrooms + 1); estimated % saving with the Table 29/30 uses (Adenda 008 kitchen tap) against the target for the zone and typology. | **Plumbing Fixtures** category, plus shared parameters for **flow (L/min)**, **flush (L)** and **test pressure (psi)**; the unit key; a bedroom regex on room `Name`. | Common-area employees and visitors per day; urinal access %. | High / medium. Present it as a pre-check: the official proof is the CASA water calculator. Feeds MS&C §3.2 too. |
| 5 (stretch) | **C-FLEX: Mc4 alternative (b)** | Share of interior partition wall area that is non-structural; minimum slab-to-slab height over dwelling rooms (2.40 m or more). | Wall **`Structural`** (Yes/No) or **`Structural Usage`** instance parameter. | , | Low-medium / low. |

What to leave out of the first slice:

- **Ep1 and SBp3 numbers**: they need the CASA calculators or a simulation.
- **Ap1**: needs IDEAM rainfall and site surfaces.
- **SBc5**: needs STC and IIC parameters that models rarely carry.
- **BEc2 and BEc3**: need site modelling.

---

## 6. Licensing and citation caveats

- **CASA guide.** I searched all 275 pages for derechos, licencia, reproducción, copyright and ©. The guide has **no licence or reuse statement**. The CCCS website footer reads "© 2026 CASA COLOMBIA | All Rights Reserved." The PDF metadata credits "Colombia gbc/ brazil gbc/ guatemala gbc". No reuse licence means:
  - Paraphrase, and quote only short phrases.
  - Link every item to its page: `https://casa.cccs.org.co/wp-content/uploads/2026/08/2026_CASA-Colombia-V3.pdf#page=<printed+1>`.
  - Store numeric thresholds as facts, each with its credit code and page.
  - Do not embed the credit text or the tables wholesale.
  - Do not re-host or rebuild the CASA calculators. Link to `https://casa.cccs.org.co/calculadores/`.
- **CASA name and mark.** The CCCS transition note has a section on "Uso de marca y logo". Avoid any wording that implies CCCS or GBCI endorsement or a certification outcome. Use "pre-check for CASA Colombia", consistent with greenr's no pass/fail rule.
- **Minvivienda annexes.** Anexo 2 (climate by municipality) and Anexo 3 (MS&C) each carry: "**Se prohíbe su uso y/o reproducción total o parcial de este documento ... salvo autorización previa, expresa y escrita del Ministerio de Vivienda, Ciudad y Territorio.**"
  - The resolution itself is an official act. Art. 13 says the annexes "integran" the resolution.
  - As I understand Colombian copyright law (Ley 23 de 1982), official acts can be reproduced if the text matches the official edition. Whether that overrides the annexes' warning is a legal question. **Do not ship the municipality-to-zone table or the shapefile** until that is cleared.
  - Ask the user for the zone and link to Anexo 2 and the geovisor.
- **Third-party standards.** NTC 1500, NTC 5316, ASHRAE 55, 62.1, 62.2 and 90.1, and the ADA Standards are copyrighted or separately published. Cite the CASA page that restates each value (for example "Ap3, p. 124–125, citing NTC 1500"), not the standard itself. The ADA ramp numbers in this brief come from ADA §405, not from CASA.
- **Citation format for exports:** "CASA Colombia 3.1 (Guía de Certificación CASA, Edición 2026), CCCS, <credit code>, p. <printed page>". For the resolution: "Resolución 0194 de 2025, Minvivienda, Art. N".

---

## 7. Corrections to the hypothesis (`casa-rows.json`)

- **"viewer" overstates feasibility.** None of the 14 "viewer" items is computable from greenr's current snapshot. All need new categories or parameters, and most need a **dwelling-unit key**.
- **BEc3 page.** BEc3 is on **p. 94** (PDF page 95). The hypothesis said "between 87 and 97".
- **SBc2 points are inverted.** The credit page says **3 points maximum, 4 for detached single-family houses**. The summary table says 4.
- **SBc5 and SBc6 points** match the credit pages: 2 (3 detached) and 2 (4 detached). SBc6's two options give only 1 point each, so the 4-point variant is unexplained in the text.
- **Ec2 points.** The summary table says 9, and so does Option 2's maximum. The credit page and Option 1 give **10**. The Energy category page totals 14.
- **CCRp3 return period.** **100 years** applies only inside a water body's floodplain. The general minimum is "piso habitable más bajo ≥ rasante de la vía". The **CCRc4** measures use **50 years** (100 in a floodplain).
- **CCRc4 Option 1** has a second path through BEc1: 1 measure earns 3 pts, 3 measures earn 5.
- **SBp9 ramp slope.** CASA gives no slope; it defers to ADA §405.
- **Mc4 height.** "2.40 m floor-to-floor" is CASA's "altura entre placas", which is ambiguous (see above).
- **GGp8 example.** The worked example contains arithmetic slips.
- **V3.1 homologation.** It is confirmed by **Adenda 02** (August 2026), not only "in process" as the CCCS transition note says.

---

## 8. Fetch log

| URL | Result |
|---|---|
| https://casa.cccs.org.co/wp-content/uploads/2026/08/2026_CASA-Colombia-V3.pdf | OK (6.6 MB, 275 pages). Tables 38 and 39 are images, read from a render. |
| https://casa.cccs.org.co/documentos-y-herramientas/ | OK |
| https://casa.cccs.org.co/calculadores/ | **Partial.** The page loaded, but the table paginates through `wp-admin/admin-ajax.php` (`tm_get_records`), which returned **HTTP 403**. An Exa fetch returned the same first 10 rows. The V3.1 IDs are inferred from the filter facet. |
| https://minvivienda.gov.co/sites/default/files/documentos/abc-resolucion-0194-de-2025-final.pdf | OK (10 pages). The phase-in graphic was read from a render. |
| https://minvivienda.gov.co/sites/default/files/documentos/adenda-01-concepto-homologacion-casa-v3-vf.pdf | OK (11 pages) |
| https://minvivienda.gov.co/sites/default/files/normativa/0194-2025.pdf (full text, found by search) | OK (15-page scan with OCR). Tables checked against the render. |
| https://minvivienda.gov.co/normativa/resolucion-0194-2025 | OK (annex links) |
| …/normativa/anexo-2-informacion-climatica-por-municipios.pdf | OK (66 pages, parsed) |
| …/normativa/anexo-3-mecanismo-de-seguimiento-y-control_0.pdf | OK (45 pages) |
| https://minvivienda.gov.co/sites/default/files/documentos/adenda-02-concepto-homologacion-casa-3.1-vf.pdf (found by search) | OK (17 pages) |
| https://casa.cccs.org.co/wp-content/uploads/2026/08/CASA-Colombia-V3.1-y-Lineamiento.pdf | OK |
| https://casa.cccs.org.co/wp-content/uploads/2025/12/2025_Adenda-CASA-Colombia-008_ET7.pdf | OK |
| https://casa.cccs.org.co/calculador-y-registro/ | OK. Fees are computed server-side and are not stated. |

Not fetched:

- Anexo 1 (the guide).
- `calculador-agua.xlsx`, the MS&C `.xlsm` macro and the climate shapefile zips.
- The CASA calculators, which were blocked.
- The base homologation concept 2025EE0076418, which I did not find published.

---

## Appendix: feasibility table

| Item | Verdict | Missing field or input |
|---|---|---|
| GGp8 (waste room) | needs-new-fields + needs-external | Room unit key + bedroom regex; municipal PGIRS per-capita rate, densities and storage days |
| BEc2 (habitat) | needs-new-fields + manual | Planting, Toposolid/Topography subregions, Property Lines, green-roof types, unit key; exterior Lighting Fixtures cutoff parameter |
| BEc3 (heat island) | needs-new-fields + needs-external | Roof `Slope`; hardscape surfaces (Toposolid, Floors at grade, Parking) with SR; tree-shade study |
| Ap3 (indoor water) | needs-new-fields | Plumbing Fixtures + flow L/min, flush L, test pressure; unit key |
| Ec4 (electrification) | needs-new-fields + manual | Electrical Fixtures (receptacles), Mechanical Equipment and heaters with fuel type, gas Piping Systems |
| SBp1 (ventilation) | needs-new-fields | Window useful opening area; room↔opening link; Mechanical Equipment/Air Terminals airflow; Parking |
| SBc2 (advanced IAQ) | needs-new-fields | Exhaust airflow per bathroom and kitchen; CO alarm family per unit; appliance fuel |
| SBc5 (acoustics) | needs-new-fields | STC/IIC on wall, floor, window and door types; unit key for separating walls |
| SBc6 (daylight 15%) | needs-new-fields | Unit key and window→unit link (VLT already read) |
| SBc7 (healthy habits) | needs-new-fields + manual | Bike racks (Parking/Specialty Equipment); room capacity parameter; unit count |
| SBc8 (social) | needs-new-fields | Room capacity parameter; unit key for residents |
| SBp9 (access) | needs-new-fields + manual | Ramps category and slope; door clear width; main-entrance flag |
| SBc10 (advanced access) | needs-new-fields + manual | Common-area room tag; door clear width; accessible WC families |
| Mc4 (circularity) | needs-new-fields | Wall `Structural`/`Structural Usage`; prefabricated flag (floor-to-floor per room is ready) |
| GGc5 (bioclimatic) | needs-external (WWR ready) | Weather data and simulation; 4-façade re-binning only |
| CCRp3 (resilience) | needs-external | Road grade elevation, flood elevation in a floodplain, hazard maps (room zmin ready) |
| CCRc4 (resilience+) | needs-external + needs-new-fields | Flood elevation and return period; Mechanical/Electrical Equipment |
| Ap1 (rainwater) | needs-external | IDEAM percentile; lot area / Property Lines; site surfaces (roof area ready) |
| Ep1 (energy) | needs-external | CASA calculator or simulation; unit vs common room tag; opaque U values |
| Ec2 (energy+) | needs-new-fields + needs-external | Lighting Fixtures wattage for LPD; equipment data sheets; simulation |
| SBp3 (thermal) | needs-external | Climate data and comfort tool; opaque reflectance and emittance (WWR, U, SHGC, VT ready) |
