# Ebola in DR Congo | Power BI Dashboard

![Power BI](https://img.shields.io/badge/Power%20BI-Portfolio%20Project-F2C811?logo=powerbi&logoColor=black)
![Period](https://img.shields.io/badge/Outbreak-2018%E2%80%932020-F56D63)

An interactive analysis of the Democratic Republic of the Congo's 2018–2020 Ebola outbreak, exploring reported cases, deaths, geographic patterns, and changes over time.

## Dashboard preview

### Health zone analysis

Explore net reported cases with province and health-zone filters, a labeled DRC province map, a top-ten ranking, and monthly reporting trends.

![Health zone analysis dashboard with DRC province map, case totals, ranked health zones, and reporting trend](docs/02-health-zone-analysis.png)

### Outbreak overview

Final WHO outbreak indicators alongside the historical national case and death reporting series.

![Outbreak overview with WHO final case and death totals and cumulative reporting trends](docs/01-outbreak-overview.png)

### All health zones

A detailed health-zone ranking and province comparison, with independent filters for deeper exploration.

![All health zones dashboard with health-zone ranking and province comparison](docs/04-all-health-zones.png)

### Data and methodology

Source coverage and interpretation notes are available inside the report.

![Data and methodology page explaining sources, reporting coverage, and limitations](docs/03-data-and-methodology.png)

## Questions explored

- What was the final reported scale of the outbreak?
- How did reported cases and deaths change over time?
- Which health zones contributed most to the available reporting series?
- How were reported cases distributed across North Kivu, Ituri, and South Kivu?

## Key findings

| Indicator | Result |
| --- | ---: |
| Final reported cases | 3,470 |
| Final reported deaths | 2,287 |
| Deaths as a share of reported cases | 65.9% |
| Affected health zones in the WHO final summary | 29 |
| Net reported cases in the geographic series | 3,418 |

WHO final figures are as of **25 June 2020**. The geographic reporting series ends on **26 January 2020**, so its total is shown separately.

Within that geographic series, **North Kivu accounts for 2,886 net reported cases**, followed by **Ituri (526)** and **South Kivu (6)**. **Beni (720)** and **Katwa (676)** have the largest health-zone totals.

## Design and interaction

- Charcoal canvas with coral highlights and consistent page navigation
- Province, health-zone, classification, and date filters
- Interactive province map with labels, boundaries, and geographic context
- Case-summary and reading-guide cards with people and book icons
- Ranked comparisons, reporting trends, and reset controls

## Open the project

1. Download and extract the whole repository.
2. Open **[Ebola DRC.pbip](Ebola%20DRC.pbip)** in Power BI Desktop on Windows.
3. In **Transform data → Manage parameters**, set `DataFolder` to your local repository's `data/clean/` folder, including the trailing slash.
4. Apply the change and refresh. The required CSV snapshots are included.

## Sources and interpretation

- **[WHO final outbreak summary](https://www.who.int/emergencies/disease-outbreak-news/item/2020-DON284)** — final cases, deaths, and affected health zones.
- **[HDX reporting archive](https://data.humdata.org/dataset/ebola-cases-and-deaths-drc-north-kivu)** — historical national reports, with Ministry of Health / WHO references.
- **[Andersen Lab](https://github.com/andersen-lab/ebola-drc-epidemiology)** — WHO-derived health-zone reporting changes.
- **[World Bank / ENERGYDATA.INFO](https://energydata.info/dataset/democratic-republic-congo-administrative-boundaries-2017/resource/659b9621-1036-43e5-a90e-4180969a2ab5)** — DRC province boundaries attributed to OCHA / UNDP, distributed under CC BY 4.0.

Net changes include retrospective corrections and are not cases by symptom-onset date. Map shading shows province reporting coverage, not population-adjusted risk or transmission across an entire province. Gaps in the historical series remain unfilled.

This is an independent historical portfolio project. Source credits and provenance are retained in the [source manifest](data/source_manifest.json); upstream reuse terms apply. Andersen Lab describes its compilation as preliminary and requests contact before publication use.
