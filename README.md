# Ebola in DR Congo: Power BI Outbreak Analysis

An interactive Power BI project exploring the Democratic Republic of the Congo's **2018–2020 Ebola outbreak**. It combines final WHO totals, historical national reporting, health-zone case changes, and a clickable province map.

**[Open the editable project](./Ebola%20DRC.pbip)** · [Source manifest](./data/source_manifest.json) · [Validation results](./validation.json)

This is a historical educational and portfolio project. It is not a live outbreak tracker, an official WHO dashboard, or a clinical decision tool. GitHub hosts the files; the interactive report runs in Power BI Desktop.

## Project at a glance

| Measure | Value | Definition and cutoff |
| --- | ---: | --- |
| Final reported cases | 3,470 | Confirmed + probable cases, WHO final summary as of 25 June 2020 |
| Final reported deaths | 2,287 | Same WHO final summary |
| Calculated case fatality ratio | 65.9% | 2,287 / 3,470, not a health-zone-specific rate |
| Affected health zones | 29 | WHO final outbreak summary |
| Geographic net reported cases | 3,418 | Health-zone reporting-change series through 26 January 2020 |
| Geographic coverage | 3 provinces | North Kivu, Ituri, and South Kivu |

The final WHO total and the geographic total cover **different reporting endpoints**. The report deliberately keeps them separate. [WHO's final outbreak summary](https://www.who.int/emergencies/disease-outbreak-news/item/2020-DON284) provides the final outbreak figures.

## Questions explored

- What was the final reported burden of this outbreak?
- How did national cumulative case and death reports change over time?
- Which health zones contributed most to the available geographic case-change series?
- Where were the reporting provinces within the DRC?
- How do reporting gaps, revisions, and source coverage affect interpretation?

## Dashboard pages

### 1. Outbreak overview

Shows final case, death, case-fatality, and affected-health-zone indicators alongside national historical reporting. The final WHO indicators are fixed outbreak-end totals. They are not recalculated from a selected subset of the historical archive.

### 2. Health zone analysis

Includes province, health-zone, and case-classification slicers; a net-case KPI; a ranked health-zone bar chart; case changes by reporting interval; province totals; and an interactive DRC province map.

Click a mapped province to filter the KPI and highlight its contribution in the charts. Click it again to clear the selection. The province slicer provides another way to filter the page. With all filters cleared, the geographic total is **3,418**. Selecting Ituri returns **526**.

The map contains all 26 province boundaries for context. Coral indicates a province represented in the current data selection. It does not represent deaths, population-adjusted risk, or transmission throughout the entire province. Gray does not mean a province has never experienced Ebola.

### 3. Data and methodology

Explains source coverage, calculation rules, and the limitations needed to interpret the visuals. Further audit details remain available in this README and the data files.

## Open the report

### Download and open the project

1. Download and extract the whole repository using **Code → Download ZIP**, or clone it.
2. Configure the local data folder as described below.
3. Open `Ebola DRC.pbip` in Power BI Desktop on Windows and refresh.
4. Explore the three report tabs. Use **File → Save as** if you want your own loaded PBIX copy.

The report opens on **Health zone analysis**. The original loaded PBIX has been verified locally but is not included in this public repository because it retains machine-specific metadata. The editable project and all required source data are provided here.

### Refresh the local data

Download the whole repository before refreshing. In Power BI Desktop, open **Transform data → Manage parameters**, then set `DataFolder` to the full path of this repository's `data/clean/` folder, including the trailing slash.

Example:

```text
C:/Data/ebola-drc-powerbi/data/clean/
```

Apply the parameter change and refresh. No API key, paid data connection, or external database is needed. Refresh reads the included CSV snapshots; it does not fetch current Ebola reports.

### Editable PBIP project

The PBIP contains readable report and semantic-model definitions. Local Power BI data caches are intentionally excluded from Git.

1. Download or clone the complete repository.
2. Configure `DataFolder`, either in Power BI Desktop or by running `node configure_data_path.mjs` before opening the project.
3. Open `Ebola DRC.pbip`, then refresh to populate the model from `data/clean/`.

The versioned model uses the example path above instead of a personal folder path. The configuration helper changes only that parameter and does not alter data or measures. Its resulting local path is machine-specific; review that change before committing it.

If PBIP is unavailable in your Desktop installation, follow [Microsoft's Power BI project guidance](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview). Project support is a Desktop preview feature and differs from Report Server Desktop.

## Data sources and coverage

Data snapshots were retrieved on **18 September 2026**. Retrieval date is not the date of the outbreak data.

| Dataset | Grain and available coverage | Source |
| --- | --- | --- |
| National reporting | 582 reporting snapshots, 3 August 2018–17 June 2020 | [HDX Ebola cases and deaths archive](https://data.humdata.org/dataset/ebola-cases-and-deaths-drc-north-kivu), with upstream Ministry of Health / WHO references retained |
| Health-zone changes | 4,466 records, 29 zones, two case classifications, 77 reporting intervals, through 26 January 2020 | [Andersen Lab's WHO-derived compilation](https://github.com/andersen-lab/ebola-drc-epidemiology) |
| Final outbreak summary | One record, as of 25 June 2020; published 26 June 2020 | [WHO Disease Outbreak News](https://www.who.int/emergencies/disease-outbreak-news/item/2020-DON284) |
| Province boundaries | 26 DRC provinces, 2017 boundary file | [World Bank / ENERGYDATA.INFO](https://energydata.info/dataset/democratic-republic-congo-administrative-boundaries-2017/resource/659b9621-1036-43e5-a90e-4180969a2ab5), curated from HDX, with OCHA / UNDP attribution in the source |

The downloaded Andersen CSV ends in January 2020 even though its repository describes a longer reporting period. This project follows the actual file, not the broader description. Andersen Lab calls its compilation preliminary and asks users planning publications to contact the lab.

Original downloads are retained in `data/raw/` and `data/maps/`. URLs and SHA-256 hashes are recorded in [source_manifest.json](./data/source_manifest.json) and [map_source.json](./data/maps/map_source.json).

### Cleaning and transformation

1. Parse source CSVs and standardize dates and numeric fields.
2. Restrict the national archive to this outbreak. Eight later rows are retained separately in `excluded_other_outbreak.csv`.
3. Unpivot the wide health-zone source into one row per health zone, case classification, and reporting interval.
4. Create stable province/health-zone keys and retain the confirmed/probable distinction.
5. Reconcile each geographic reporting interval to its source control total.
6. Preserve negative revisions, missing dates, and opening-balance flags instead of treating them as zero or ordinary weekly incidence.
7. Build the calendar, final-summary, and quality-note tables.

For the map, `Nord-Kivu` and `Sud-Kivu` are normalized to `North Kivu` and `South Kivu` for the join. The original boundary download has an extraneous trailing `System.IO.MemoryStream` export artifact. Only that exact suffix is removed from the derived copy. The raw response remains intact. All **71,060 coordinate points** are preserved in a lossless, unquantized TopoJSON conversion. The report packages this geometry locally and does not require online basemap tiles.

## Data model

Six imported tables and three one-to-many, single-direction relationships separate reporting snapshots from reporting changes.

```text
Calendar[Date] ───────┬──> National[Report date]
                     └──> Case changes[Report date]
Health zones[Zone key] ──> Case changes[Zone key]

WHO final       (disconnected, fixed final outbreak totals)
Quality notes   (disconnected audit table)
```

| Table | Main fields and purpose |
| --- | --- |
| `National` | Report/publication dates, confirmed/probable cases, cumulative cases/deaths/recoveries, net changes, days since previous report, original source |
| `Case changes` | Report and previous-report dates, period label, zone key, classification, net change, negative-revision flag, opening-balance flag, interval length |
| `Health zones` | Zone key, health zone, province, country |
| `WHO final` | As-of date, confirmed/probable/total cases, deaths, reported recoveries, affected zones, source |
| `Calendar` | Date, year, month |
| `Quality notes` | Dataset, date, issue, supporting detail |

The semantic model contains 15 DAX measures. All definitions are available in [model.bim](./Ebola%20DRC.SemanticModel/model.bim).

### Key DAX measures

```dax
Final cases = SUM('WHO final'[Total cases])
Final deaths = SUM('WHO final'[Deaths])
Final case fatality ratio = DIVIDE([Final deaths], [Final cases])

Reported cases =
VAR SnapshotDate = MAX('National'[Report date])
RETURN
    CALCULATE(
        MAX('National'[Cumulative cases]),
        'National'[Report date] = SnapshotDate
    )

Net reported cases = SUM('Case changes'[Net case change])
```

**Cumulative national snapshots are never summed across dates.** The latest available reporting snapshot in context is used. Geographic net changes can be added, including corrections. A reporting interval is not necessarily seven days, and the opening balance has an unknown starting date. These values do not measure cases by symptom-onset date.

## Validation and important limitations

Power BI Desktop checks on 18 September 2026 confirmed that all six tables load and all three pages render. Native DAX results matched independent source calculations. Province filtering and map clicking returned Ituri's 526 cases and were cleared back to 3,418. The final PBIX includes its data model and province geometry, and its visual configurations match the PBIP.

Additional checks recorded in [validation.json](./validation.json):

- Geographic counts reconcile to **3,418**, comprising 3,299 confirmed and 119 probable net cases.
- All **37 negative revision records** are retained, and all 77 reporting intervals reconcile to source controls.
- National report dates are unique. The 24 May 2019 source has a six-case difference between confirmed + probable and its stated total. Original figures are retained and flagged.
- The national archive contains a **95-day reporting gap** between 7 March and 10 June 2020. No daily values are imputed. A line connecting observations does not establish when changes occurred during the gap.
- The final national archive observation is **3,463 cases and 2,280 deaths** on 17 June 2020. It is earlier than the final WHO total and differs by seven cases and seven deaths.
- WHO's reported 1,171 recoveries and 2,287 deaths do not account for 12 of the 3,470 cases. No outcome is invented for that remainder, and it is not labelled as active cases.
- The supplementary HDX health-zone file is **not loaded**. Its 17 June 2020 Butembo record reports 303 cases and 361 deaths. This needs source clarification before calculating health-zone fatality ratios.
- There are no population denominators, patient-level records, onset dates, matched health-zone boundaries, or verified vaccination series. The report does not calculate per-capita incidence, survival, vaccine effectiveness, or health-zone transmission extent.

The archive's national and geographic endpoints must not be treated as interchangeable. Comparisons in the report are descriptive, not causal.

## Design

The report uses a near-black canvas (`#121212`), charcoal panels (`#202020`), off-white headings, dusty-red Health zone charts (`#B85C64`), and brighter coral province highlights (`#E65B65`). The overview uses gray for cases and coral for deaths. Map color has its own meaning: province coverage in the selected reporting data.

The color update did not change queries, calculations, source data, or geographic boundaries. Controls and labels remain native Power BI elements rather than a flattened dashboard image.

## Repository structure

```text
Ebola DRC.pbip                 Editable project entry point
Ebola DRC.Report/              Report definition and packaged map/theme
Ebola DRC.SemanticModel/       Tables, relationships, Power Query and DAX
data/
  raw/                        Original reporting downloads
  clean/                      Prepared model inputs and excluded rows
  maps/                       Raw/normalized geometry and provenance
  source_manifest.json        Source URLs and hashes
build_project.mjs             Rebuild data, model and report definitions
configure_data_path.mjs       Configure a local CSV folder
apply_charcoal_theme.mjs      Base report styling
add_province_map.mjs          Province geometry and map layout
apply_health_zone_red.mjs     Health zone chart colors
validate_project.mjs          Repository structure and source-hash checks
validation.json               Data and Desktop verification results
```

Private local caches, recovery files, backup copies, credentials, and unrelated projects are excluded. The Microsoft sample report used during development is not distributed here.

## Reproduce or extend the project

Opening and refreshing the project requires Power BI Desktop. Rebuilding requires **Node.js 18 or later** and the complete repository. The scripts use built-in Node modules and require no npm installation.

```sh
git clone https://github.com/krishnamvwala/ebola-drc-powerbi.git
cd ebola-drc-powerbi
node configure_data_path.mjs
```

To regenerate the clean data and report definitions:

```sh
node build_project.mjs
```

Close the project in Power BI before rebuilding. The build **overwrites generated CSVs, the model, the report definition, and validation.json**, so preserve manual edits first. It uses the included source snapshots and bundled base theme; it does not download new data. Map and approved color steps run automatically. Power BI Desktop is still required to load/refresh the regenerated project and save a PBIX. A rebuild does not create or update a binary PBIX automatically.

Run the repository checks with Node.js:

```sh
node validate_project.mjs
```

That command checks model structure, relationships, measure count, source hashes, report colors, geometry, and README file links. It does not replace native rendering or DAX checks. The standalone build was also tested in a separate folder: all seven generated CSVs matched the distributed files byte for byte. Review the native report after changing the model, sources, or layout.

## Attribution and reuse

Report project maintained by [Krishna / krishnamvwala](https://github.com/krishnamvwala). Public-health data and geographic boundaries belong to their respective providers.

- HDX metadata identifies its reporting archive as CC BY-IGO and lists Ministry of Health / WHO sources.
- The World Bank boundary distributor lists CC BY 4.0. The boundary source attributes credit OCHA / UNDP. Geometry conversion and name normalization are documented above.
- Andersen Lab provides its preliminary compilation for use and requests contact before inclusion in publications. Follow its upstream guidance and credit the original work.
- WHO figures and Power BI platform resources retain their applicable source terms. No endorsement by WHO, OCHA, UNDP, the World Bank, Andersen Lab, or Microsoft is implied.

No blanket license is applied to the mixed third-party material in this repository. Consult each source's terms before reuse or redistribution. For data corrections, open an issue with the source, reporting date, affected field, and supporting reference.
