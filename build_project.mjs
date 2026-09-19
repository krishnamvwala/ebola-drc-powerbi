import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
const root = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(root, 'data/raw');
const dataDir = path.join(root, 'data/clean');
fs.mkdirSync(dataDir, {recursive:true});
function csvParse(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++) { const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(field);field='';}
    else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  return rows;
}
const csvEscape=v=>v===null||v===undefined?'':/[",\r\n]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v);
function writeCSV(name,rows){const cols=Object.keys(rows[0]); fs.writeFileSync(path.join(dataDir,name),[cols,...rows.map(r=>cols.map(k=>r[k]))].map(r=>r.map(csvEscape).join(',')).join('\r\n')+'\r\n');}
function writeJSON(name,value){fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,JSON.stringify(value,null,2)+'\n');}
function check(test,message){if(!test)throw Error(message);}
const issues=[];
const hdx=csvParse(fs.readFileSync(path.join(raw,'hdx_national.csv'),'utf8'));
const nationalRaw=hdx.slice(1).filter(r=>/^\d{4}-/.test(r[1])).map(r=>Object.fromEntries(hdx[0].map((h,i)=>[h,r[i]])));
// The archive switches to the separate Equateur outbreak after the June 25 closure.
const excluded=nationalRaw.filter(r=>r.report_date>'2020-06-25');
const included=nationalRaw.filter(r=>r.report_date<='2020-06-25').sort((a,b)=>a.report_date.localeCompare(b.report_date));
const number=v=>v===''||v===undefined?null:Number(v);
const national=included.map((r,i)=>{
  const p=included[i-1]; const days=p?(Date.parse(r.report_date)-Date.parse(p.report_date))/86400000:null;
  const cases=number(r.total_cases),deaths=number(r.total_deaths);
  if(cases!==number(r.confirmed_cases)+number(r.probable_cases))issues.push({Dataset:'National',Date:r.report_date,Issue:'Confirmed plus probable differs from total',Detail:`${r.confirmed_cases} + ${r.probable_cases} versus ${cases}`});
  if(days>7)issues.push({Dataset:'National',Date:r.report_date,Issue:'Reporting gap exceeds seven days',Detail:`${days} days since ${p.report_date}. No daily allocation or interpolation applied.`});
  return {'Report date':r.report_date,'Publication date':r.publication_date,'Confirmed cases':number(r.confirmed_cases),'Probable cases':number(r.probable_cases),'Cumulative cases':cases,'Cumulative deaths':deaths,'Cumulative recoveries':number(r.total_cured),'Net case change':p?cases-number(p.total_cases):null,'Net death change':p?deaths-number(p.total_deaths):null,'Days since previous report':days,'Source':r.source};
});
check(new Set(national.map(r=>r['Report date'])).size===national.length,'Duplicate national dates require resolution');
check(national.every(r=>r['Cumulative deaths']<=r['Cumulative cases']),'Deaths exceed cases');
writeCSV('national_reports.csv',national);
writeCSV('excluded_other_outbreak.csv',excluded);

const a=csvParse(fs.readFileSync(path.join(raw,'andersen_who_2018_2020.csv'),'utf8'));
const months={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,August:8,Sep:9,Oct:10,Nov:11,Dec:12};
function iso(s){const [d,m,y]=s.trim().split(/\s+/);check(months[m]&&y,'Unknown date '+s);return `${y}-${String(months[m]).padStart(2,'0')}-${d.padStart(2,'0')}`;}
const periods=a[0].slice(3).map((s,i)=>{const parts=s.split(' - ');return {index:i,label:s,start:parts[0]==='unknown'?null:iso(parts[0]),end:iso(parts[1])};});
let province='';const zones=[],weekly=[];
for(const row of a.slice(2)){
  if(row[1]==='Total New Cases by Week')continue;
  if(row[0])province=row[0].trim();
  const zone=row[1].trim(),type=row[2].trim();
  check(['Confirmed','Probable'].includes(type),'Unexpected case type');
  const key=province+' | '+zone;
  if(!zones.some(z=>z['Zone key']===key))zones.push({'Zone key':key,'Province':province,'Health zone':zone,'Country':'Democratic Republic of the Congo'});
  check(row.length===a[0].length,'Source row length mismatch');
  periods.forEach((p,i)=>{const value=Number(row[i+3]);check(Number.isInteger(value),'Non-numeric count');
    weekly.push({'Report date':p.end,'Previous report date':p.start,'Period label':p.label,'Zone key':key,'Case classification':type,'Net case change':value,'Is negative revision':value<0?1:0,'Is opening balance':p.start===null?1:0,'Interval days':p.start?(Date.parse(p.end)-Date.parse(p.start))/86400000:null});
    if(value<0)issues.push({Dataset:'Health zones',Date:p.end,Issue:'Negative source revision',Detail:`${province}, ${zone}, ${type}: ${value}. Retained in net totals.`});
  });
}
const totalRow=a.find(r=>r[1]==='Total New Cases by Week');
periods.forEach((p,i)=>check(weekly.filter(r=>r['Report date']===p.end).reduce((s,r)=>s+r['Net case change'],0)===Number(totalRow[i+3]),'Weekly source control mismatch '+p.end));
check(zones.length===29&&weekly.length===4466,'Unexpected geographic record count');
writeCSV('health_zone_case_changes.csv',weekly);writeCSV('health_zones.csv',zones);
const whoURL='https://www.who.int/emergencies/disease-outbreak-news/item/2020-DON284';
const final=[{'As of date':'2020-06-25','Confirmed cases':3317,'Probable cases':153,'Total cases':3470,'Deaths':2287,'Reported recoveries':1171,'Affected health zones':29,'Source':whoURL}];
writeCSV('who_final_summary.csv',final);
const dates=[];for(let t=Date.parse('2018-08-01');t<=Date.parse('2020-06-25');t+=86400000){const d=new Date(t).toISOString().slice(0,10);dates.push({'Date':d,'Year':Number(d.slice(0,4)),'Month':d.slice(0,7)});}
writeCSV('calendar.csv',dates);writeCSV('quality_notes.csv',issues);
const totalCases=weekly.reduce((s,r)=>s+r['Net case change'],0);
check(totalCases===3418,'Unexpected detail net total');
const audit={nationalRows:national.length,nationalFirst:national[0]['Report date'],nationalLast:national.at(-1)['Report date'],nationalLastCases:national.at(-1)['Cumulative cases'],excludedOtherOutbreakRows:excluded.length,healthZoneRows:weekly.length,healthZones:zones.length,reportingPeriods:periods.length,geographyLast:periods.at(-1).end,geographicNetCases:totalCases,negativeRevisions:weekly.filter(r=>r['Net case change']<0).length,whoFinalCases:3470,whoFinalDeaths:2287,whoFinalCFR:2287/3470,qualityNotes:issues.length};
writeJSON(path.join(root,'validation.json'),audit);
writeJSON(path.join(root,'data/source_manifest.json'),{retrieved:'2026-09-18',sources:[{name:'HDX national reporting series',url:'https://data.humdata.org/dataset/ebola-cases-and-deaths-drc-north-kivu',publisher:'HDX; source links to DRC Ministry of Health and WHO reports',license:'CC BY-IGO (HDX metadata)',local:'raw/hdx_national.csv',sha256:createHash('sha256').update(fs.readFileSync(path.join(raw,'hdx_national.csv'))).digest('hex')},{name:'Andersen Lab WHO-derived health-zone case changes',url:'https://github.com/andersen-lab/ebola-drc-epidemiology',gitBlob:'462f31858204db53c01d4524c3b09e466fb833cf',local:'raw/andersen_who_2018_2020.csv',actualCoverage:'Opening balance through 2018-08-05, then report intervals through 2020-01-26',sha256:createHash('sha256').update(fs.readFileSync(path.join(raw,'andersen_who_2018_2020.csv'))).digest('hex')},{name:'WHO final outbreak summary',url:whoURL,publicationDate:'2020-06-26',asOf:'2020-06-25',local:'clean/who_final_summary.csv'}]});

// Build a native Power BI project. File-based imports refresh from the clean CSVs.
const modelDir=path.join(root,'Ebola DRC.SemanticModel'),reportDir=path.join(root,'Ebola DRC.Report');
const model={name:'Ebola DRC',compatibilityLevel:1567,model:{culture:'en-US',defaultPowerBIDataSourceVersion:'powerBI_V3',dataAccessOptions:{legacyRedirects:true,returnErrorValuesAsNull:true},annotations:[{name:'__PBI_TimeIntelligenceEnabled',value:'0'}],expressions:[{name:'DataFolder',kind:'m',expression:'"'+dataDir.replaceAll('\\','/')+'/" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]'}],tables:[],relationships:[]}};
const specs=[['National','national_reports.csv',national],['Case changes','health_zone_case_changes.csv',weekly],['Health zones','health_zones.csv',zones],['WHO final','who_final_summary.csv',final],['Calendar','calendar.csv',dates],['Quality notes','quality_notes.csv',issues]];
function kind(k,v){if(/date$/i.test(k)&&!/Days/.test(k))return 'dateTime';return typeof v==='number'?'int64':'string';}
for(const [name,file,rows] of specs){
  const cols=Object.keys(rows[0]).map(k=>{const v=rows.map(r=>r[k]).find(x=>x!==null&&x!==undefined);const dt=kind(k,v);return {name:k,dataType:dt,sourceColumn:k,summarizeBy:'none',lineageTag:randomUUID(),...(dt==='dateTime'?{formatString:'dd MMM yyyy'}:dt==='int64'?{formatString:'#,0'}:{})};});
  const transforms=cols.map(c=>`{"${c.name}", ${c.dataType==='int64'?'Int64.Type':c.dataType==='dateTime'?'type date':'type text'}}`).join(', ');
  const table={name,lineageTag:randomUUID(),columns:cols,partitions:[{name,mode:'import',source:{type:'m',expression:['let',`    Source = Csv.Document(File.Contents(DataFolder & "${file}"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),`,'    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),',`    Typed = Table.TransformColumnTypes(Headers, {${transforms}}, "en-US")`,'in','    Typed']}}]};
  model.model.tables.push(table);
}
function relation(from,col,to,toCol){model.model.relationships.push({name:randomUUID(),fromTable:from,fromColumn:col,toTable:to,toColumn:toCol,crossFilteringBehavior:'oneDirection'});}
relation('National','Report date','Calendar','Date');relation('Case changes','Report date','Calendar','Date');relation('Case changes','Zone key','Health zones','Zone key');
const calendar=model.model.tables.find(t=>t.name==='Calendar');calendar.columns[0].isKey=true;calendar.annotations=[{name:'PBI_Id',value:randomUUID()}];
function measure(table,name,expression,format='#,0',description=''){const t=model.model.tables.find(t=>t.name===table);(t.measures??=[]).push({name,expression,formatString:format,description,lineageTag:randomUUID()});}
measure('WHO final','Final cases',"SUM('WHO final'[Total cases])",'#,0','WHO final total, as of 25 June 2020.');
measure('WHO final','Final deaths',"SUM('WHO final'[Deaths])");
measure('WHO final','Final case fatality ratio','DIVIDE([Final deaths], [Final cases])','0.0%','Reported deaths divided by confirmed plus probable cases, same final date.');
measure('WHO final','Final affected health zones',"MAX('WHO final'[Affected health zones])");
measure('WHO final','Final confirmed',"SUM('WHO final'[Confirmed cases])");measure('WHO final','Final probable',"SUM('WHO final'[Probable cases])");
measure('National','Reported cases',"VAR SnapshotDate = MAX('National'[Report date]) RETURN CALCULATE(MAX('National'[Cumulative cases]), 'National'[Report date] = SnapshotDate)",'#,0','Latest observation in the filter context. Never sums cumulative counts over time.');
measure('National','Reported deaths',"VAR SnapshotDate = MAX('National'[Report date]) RETURN CALCULATE(MAX('National'[Cumulative deaths]), 'National'[Report date] = SnapshotDate)");
measure('National','Reporting observations',"COUNTROWS('National')");
measure('National','Longest reporting gap',"MAX('National'[Days since previous report])");
measure('Case changes','Net reported cases',"SUM('Case changes'[Net case change])",'#,0','Net changes between reporting snapshots, including negative retrospective revisions and the opening balance. Not an onset-date incidence curve.');
measure('Case changes','Confirmed case changes',"CALCULATE([Net reported cases], KEEPFILTERS('Case changes'[Case classification] = \"Confirmed\"))");
measure('Case changes','Probable case changes',"CALCULATE([Net reported cases], KEEPFILTERS('Case changes'[Case classification] = \"Probable\"))");
measure('Case changes','Negative revision records',"CALCULATE(COUNTROWS('Case changes'), 'Case changes'[Is negative revision] = 1)");
measure('Case changes','Health zones in selection',"DISTINCTCOUNT('Case changes'[Zone key])");
for(const t of model.model.tables)for(const m of t.measures??[])check(!t.columns.some(c=>c.name.toLowerCase()===m.name.toLowerCase()),'Measure conflicts with column '+m.name);
writeJSON(path.join(modelDir,'model.bim'),model);
writeJSON(path.join(modelDir,'definition.pbism'),{version:'4.0',settings:{}});
writeJSON(path.join(reportDir,'definition.pbir'),{version:'4.0',datasetReference:{byPath:{path:'../Ebola DRC.SemanticModel'}}});
writeJSON(path.join(root,'Ebola DRC.pbip'),{version:'1.0',artifacts:[{report:{path:'Ebola DRC.Report'}}],settings:{enableAutoRecovery:true}});

const C={navy:'#122C3A',teal:'#007F83',orange:'#D27C32',red:'#BC4B51',ink:'#193746',muted:'#586D78',paper:'#F0F4F6',white:'#FFFFFF',line:'#D9E3E8'};
const literal=v=>({expr:{Literal:{Value:typeof v==='string'?"'"+v.replaceAll("'","''")+"'":typeof v==='boolean'?String(v):v+'D'}}});
const color=c=>({solid:{color:literal(c)}});
const obj=p=>[{properties:p}];
const seriesColor=(q,c)=>({selector:{metadata:q},properties:{fill:color(c)}});
const measureField=(t,n)=>({table:t,name:n,measure:true});const columnField=(t,n)=>({table:t,name:n});
function fieldExpr(f,aliases){return {[f.measure?'Measure':'Column']:{Expression:{SourceRef:{Source:aliases[f.table]}},Property:f.name}};}
let next=0;
function visual(type,box,title,fields=[],roles={},extra={}){
  const name='evd'+String(++next).padStart(17,'0');const [x,y,width,height]=box;const z=next*1000;
  const aliases=Object.fromEntries([...new Set(fields.map(f=>f.table))].map((t,i)=>[t,'t'+i]));
  const qref=f=>f.table+'.'+f.name;
  const query={Version:2,From:Object.entries(aliases).map(([Entity,Name])=>({Name,Entity,Type:0})),Select:fields.map(f=>({...fieldExpr(f,aliases),Name:qref(f),NativeReferenceName:f.name}))};
  if(extra.sort){const f=fields[extra.sort.index];query.OrderBy=[{Direction:extra.sort.desc?2:1,Expression:fieldExpr(f,aliases)}];}
  const sv={visualType:type,projections:Object.fromEntries(Object.entries(roles).map(([k,indices])=>[k,indices.map(i=>({queryRef:qref(fields[i]),...(k==='Category'||type==='slicer'?{active:true}:{})}))])),prototypeQuery:query,drillFilterOtherVisuals:true,objects:extra.objects??{},vcObjects:{title:obj({show:literal(!!title),text:literal(title||''),fontSize:literal(12),bold:literal(true),fontColor:color(C.ink)}),background:obj({show:literal(true),color:color(C.white),transparency:literal(0)}),border:obj({show:literal(true),color:color(C.line),radius:literal(6)}),visualHeader:obj({show:literal(false)})}};
  if(!fields.length){delete sv.prototypeQuery;delete sv.projections;}
  return {config:JSON.stringify({name,layouts:[{id:0,position:{x,y,z,width,height,tabOrder:z}}],singleVisual:sv}),filters:'[]',x,y,z,width,height};
}
function textBox(box,text,size=12,ink=C.ink,bg=C.paper){const v=visual('textbox',box,'',[],{}, {objects:{general:obj({paragraphs:[{textRuns:[{value:text,textStyle:{fontFamily:'Segoe UI',fontSize:`${size}pt`,color:ink}}]}]})}});const c=JSON.parse(v.config);c.singleVisual.vcObjects.background=obj({show:literal(true),color:color(bg),transparency:literal(0)});c.singleVisual.vcObjects.border=obj({show:literal(false)});v.config=JSON.stringify(c);return v;}
function card(box,table,name,title,ink=C.teal){return visual('card',box,title,[measureField(table,name)],{Values:[0]},{objects:{labels:obj({fontSize:literal(30),color:color(ink),labelDisplayUnits:literal(1),labelPrecision:literal(name.includes('ratio')?1:0)}),categoryLabels:obj({show:literal(false)})}});}
function chart(type,box,title,category,measures,sortDesc=false){const fields=[category,...measures];return visual(type,box,title,fields,{Category:[0],Y:measures.map((_,i)=>i+1)},{sort:{index:sortDesc?1:0,desc:sortDesc},objects:{categoryAxis:obj({showAxisTitle:literal(false),labelColor:color(C.muted),fontSize:literal(10)}),valueAxis:obj({showAxisTitle:literal(false),labelColor:color(C.muted),labelDisplayUnits:literal(1)}),dataPoint:[{properties:{defaultColor:color(C.teal)}},...measures.map((m,i)=>seriesColor(m.table+'.'+m.name,i===0?C.teal:C.red))],legend:obj({show:literal(measures.length>1),position:literal('Top'),labelColor:color(C.muted)}),labels:obj({show:literal(type==='clusteredBarChart'),fontSize:literal(10),labelDisplayUnits:literal(1),labelPrecision:literal(0),color:color(C.ink)})}});}
function slicer(box,f,title){return visual('slicer',box,title,[f],{Values:[0]},{objects:{data:obj({mode:literal('Dropdown')}),header:obj({show:literal(false)}),items:obj({fontColor:color(C.ink),textSize:literal(11)}),general:obj({selfFilterEnabled:literal(true)}),selection:obj({selectAllCheckboxEnabled:literal(true)})}});}
function page(name,title,subtitle){return {name,displayName:title,ordinal:0,width:1280,height:720,displayOption:1,filters:'[]',config:JSON.stringify({objects:{background:obj({color:color(C.paper),transparency:literal(0)})}}),visualContainers:[textBox([0,0,1280,76],title.toUpperCase(),28,C.white,C.navy),textBox([24,82,1232,48],subtitle,12,C.muted)]};}
const p1=page('ReportSectionOverview','Outbreak overview','DRC 10th outbreak · North Kivu, Ituri and South Kivu · Final WHO totals as of 25 June 2020');
p1.visualContainers.push(card([24,143,292,114],'WHO final','Final cases','Final reported cases'),card([332,143,292,114],'WHO final','Final deaths','Final reported deaths',C.red),card([640,143,292,114],'WHO final','Final case fatality ratio','Deaths / reported cases',C.orange),card([948,143,308,114],'WHO final','Final affected health zones','Affected health zones',C.ink));
p1.visualContainers.push(chart('lineChart',[24,278,858,350],'Cumulative cases and deaths at available report dates',columnField('National','Report date'),[measureField('National','Reported cases'),measureField('National','Reported deaths')]));
p1.visualContainers.push(textBox([902,278,354,350],'READING THIS REPORT\n\nThe line uses historical HDX reports through 17 June 2020. Missing dates are not filled. Lines connect available reports.\n\nThe cards use WHO’s final totals on 25 June 2020.\n\nGeographic case detail ends on 26 January 2020. Open Health zone analysis for the available regional breakdown.',13,C.ink,C.white));
p1.visualContainers.push(textBox([24,643,1232,52],'Sources: WHO final summary, 26 June 2020; HDX / DRC Ministry of Health reporting archive. Case fatality ratio uses confirmed + probable cases.',11,C.muted));
const p2=page('ReportSectionGeography','Health zone analysis','Case reporting changes · 5 August 2018 opening balance to 26 January 2020 · Includes retrospective revisions');
p2.visualContainers.push(slicer([24,138,260,70],columnField('Health zones','Province'),'Province'),slicer([300,138,280,70],columnField('Health zones','Health zone'),'Health zone'),slicer([596,138,280,70],columnField('Case changes','Case classification'),'Case classification'),card([892,138,364,96],'Case changes','Net reported cases','Net cases in selection'));
p2.visualContainers.push(chart('clusteredBarChart',[24,248,440,392],'Net reported cases by health zone',columnField('Health zones','Health zone'),[measureField('Case changes','Net reported cases')],true));
p2.visualContainers.push(chart('clusteredColumnChart',[480,248,776,250],'Net case changes by reporting interval',columnField('Case changes','Report date'),[measureField('Case changes','Net reported cases')]));
p2.visualContainers.push(chart('clusteredBarChart',[480,514,776,126],'Net reported cases by province',columnField('Health zones','Province'),[measureField('Case changes','Net reported cases')],true));
p2.visualContainers.push(textBox([24,655,1232,44],'Select a province, zone or classification to explore. Negative values are retained source corrections. Intervals vary in length. These are reporting changes, not symptom-onset incidence.',10,C.muted));
const p3=page('ReportSectionQuality','Data and methodology','Source coverage, calculation rules and limitations');
p3.visualContainers.push(card([24,140,292,108],'National','Reporting observations','National observations'),card([332,140,292,108],'National','Longest reporting gap','Longest report gap (days)',C.orange),card([640,140,292,108],'Case changes','Negative revision records','Negative detail revisions',C.red),card([948,140,308,108],'Case changes','Health zones in selection','Health zones in dataset',C.ink));
p3.visualContainers.push(textBox([24,270,600,355],'DATA COVERAGE\n\nWHO final summary: 25 June 2020.\nNational reporting archive: 3 August 2018–17 June 2020. Records after the outbreak closure belong to a different outbreak and are excluded.\nHealth-zone detail: 77 reporting intervals through 26 January 2020, 29 health zones and 3 provinces.\n\nThe Andersen Lab README describes a longer period than the downloaded CSV. This report follows the actual file coverage.\n\nRaw downloads and source links are included in the project data folder.',13,C.ink,C.white));
p3.visualContainers.push(textBox([644,270,612,355],'CALCULATION RULES\n\nCumulative counts use the latest available report in context. They are never added across dates.\nCase fatality ratio = final reported deaths / final reported cases (confirmed + probable).\nNet case changes retain negative revisions. Opening balances are identified. Missing dates and values remain missing.\n\nGeographic detail totals 3,418 net cases at its cutoff and is not expected to equal the final 3,470. Deaths by health zone are not inferred.\nWHO reported recoveries do not fully reconcile cases minus deaths; no extra outcomes are invented.',13,C.ink,C.white));
p3.visualContainers.push(textBox([24,644,1232,52],'Historical educational analysis. Data retrieved 18 September 2026. Detailed source references and quality exceptions: README.md, data/source_manifest.json and data/clean/quality_notes.csv.',11,C.muted));
const pages=[p1,p2,p3];pages.forEach((p,i)=>p.ordinal=i);
const base=path.join(reportDir,'StaticResources/SharedResources/BaseThemes/CY24SU08.json');
check(fs.existsSync(base),'Missing bundled Power BI base theme. Restore the Report/StaticResources folder from the repository.');
const theme={name:'Ebola DRC',dataColors:[C.teal,C.red,C.orange,C.navy,'#769AA6'],background:C.white,foreground:C.ink,tableAccent:C.teal};
writeJSON(path.join(reportDir,'StaticResources/RegisteredResources/EbolaDRC.json'),theme);
writeJSON(path.join(root,'EbolaDRC-theme.json'),theme);
const report={config:JSON.stringify({version:'5.57',themeCollection:{baseTheme:{name:'CY24SU08',version:'5.57',type:2},customTheme:{name:'EbolaDRC.json',version:'5.57',type:1}},activeSectionIndex:0,defaultDrillFilterOtherVisuals:true,settings:{useNewFilterPaneExperience:true,allowChangeFilterTypes:true,useStylableVisualContainerHeader:true}}),layoutOptimization:0,resourcePackages:[{resourcePackage:{name:'SharedResources',type:2,items:[{name:'CY24SU08',path:'BaseThemes/CY24SU08.json',type:202}],disabled:false}},{resourcePackage:{name:'RegisteredResources',type:1,items:[{name:'EbolaDRC.json',path:'EbolaDRC.json',type:201}],disabled:false}}],sections:pages,theme:'EbolaDRC.json'};
writeJSON(path.join(reportDir,'report.json'),report);
for(const p of pages)for(const v of p.visualContainers)check(v.x>=0&&v.y>=0&&v.x+v.width<=p.width&&v.y+v.height<=p.height,'Visual outside page');
console.log(JSON.stringify(audit,null,2));
// Preserve the approved presentation whenever the project is regenerated.
await import('./apply_charcoal_theme.mjs');
if (fs.existsSync(path.join(root,'data/maps/drc_provinces_2017.geojson'))) await import('./add_province_map.mjs');
await import('./apply_health_zone_red.mjs');
