import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const maps=path.join(root,'data/maps');
const rawPath=path.join(maps,'drc_provinces_2017.geojson');
const raw=fs.readFileSync(rawPath,'utf8');
// This public download contains one non-JSON export footer. Preserve the raw
// response and remove only that exact footer in the derived working copy.
const trailingExportFooter=/\s*System\.IO\.MemoryStream\s*$/;
const source=JSON.parse(raw.replace(trailingExportFooter,''));
if(source.type!=='FeatureCollection'||source.features.length!==26)throw new Error('Expected 26 provinces');
const aliases={'Nord-Kivu':'North Kivu','Sud-Kivu':'South Kivu','Ituri':'Ituri'};
const normalized=structuredClone(source);
delete normalized.crs;
for(const f of normalized.features){
  f.id=aliases[f.properties.NOM]??f.properties.NOM;
  f.properties={name:f.id,source_name:f.properties.NOM,pcode:f.properties.PCode};
}
const affected=['North Kivu','Ituri','South Kivu'];
for(const name of affected)if(normalized.features.filter(f=>f.properties.name===name).length!==1)throw new Error(`Unmatched province: ${name}`);
// Lossless ring-to-arc conversion. Absolute arcs, no quantization, no geometry
// simplification, and no changed coordinates; shared boundaries are duplicated.
const topology={type:'Topology',objects:{provinces:{type:'GeometryCollection',geometries:[]}},arcs:[]};
const points=[];
function polygon(rings){return rings.map(ring=>{for(const p of ring){if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))throw new Error('Invalid coordinate');points.push(p);}const i=topology.arcs.push(ring)-1;return [i];});}
for(const f of normalized.features){
  const {type,coordinates}=f.geometry;
  if(!['Polygon','MultiPolygon'].includes(type))throw new Error(`Unsupported geometry: ${type}`);
  topology.objects.provinces.geometries.push({type,id:f.id,properties:f.properties,arcs:type==='Polygon'?polygon(coordinates):coordinates.map(polygon)});
}
const bbox=points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
topology.bbox=bbox;
if(bbox[0]<10||bbox[2]>33||bbox[1]<-15||bbox[3]>7)throw new Error('Unexpected DRC extent');
const json=v=>JSON.stringify(v);
fs.writeFileSync(path.join(maps,'drc_provinces_clean.geojson'),json(normalized));
fs.writeFileSync(path.join(maps,'drc_provinces.topojson'),json(topology));
const reportPath=path.join(root,'Ebola DRC.Report/report.json');
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const page=report.sections.find(p=>p.displayName==='Health zone analysis');
if(!page)throw new Error('Missing health-zone page');
const modelPath=path.join(root,'Ebola DRC.SemanticModel/model.bim');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const modelHash=hash(modelPath);
const lit=v=>({expr:{Literal:{Value:typeof v==='string'?`'${v.replaceAll("'","''")}'`:typeof v==='boolean'?String(v):`${v}D`}}});
const fill=c=>({solid:{color:lit(c)}});
const obj=properties=>[{properties}];
const resourceName='DRC_Provinces_2017.json';
const registered=report.resourcePackages.find(p=>p.resourcePackage.name==='RegisteredResources').resourcePackage;
if(!registered.items.some(i=>i.name===resourceName))registered.items.push({name:resourceName,path:resourceName,type:100});
fs.writeFileSync(path.join(root,'Ebola DRC.Report/StaticResources/RegisteredResources',resourceName),json(topology));
function reposition(name,box){
  const v=page.visualContainers.find(v=>JSON.parse(v.config).name===name);
  if(!v)throw new Error(`Missing visual ${name}`);
  const c=JSON.parse(v.config);const [x,y,width,height]=box;
  Object.assign(v,{x,y,width,height});for(const l of c.layouts)Object.assign(l.position,{x,y,width,height});
  v.config=json(c);return v;
}
reposition('evd00000000000000016',[468,248,350,392]);
reposition('evd00000000000000017',[834,248,422,242]);
reposition('evd00000000000000018',[834,506,422,134]);
const footer=reposition('evd00000000000000019',[24,654,1232,48]);
const fc=JSON.parse(footer.config);
fc.singleVisual.objects.general[0].properties.paragraphs=[{textRuns:[{value:'Reporting changes, not symptom-onset incidence. Negative source corrections are retained.\nProvince boundaries: OCHA / UNDP via World Bank / HDX (2017). Shading does not imply transmission everywhere in a province.',textStyle:{fontFamily:'Segoe UI',fontSize:'10pt',color:'#B7BBC1'}}]}];
footer.config=json(fc);
function container(name,box,sv){const [x,y,width,height]=box;const z=95000;const position={x,y,width,height,z,tabOrder:z};return {...position,filters:'[]',config:json({name,layouts:[{id:0,position}],singleVisual:sv})};}
const province={Column:{Expression:{SourceRef:{Source:'h'}},Property:'Province'}};
const netCases={Measure:{Expression:{SourceRef:{Source:'c'}},Property:'Net reported cases'}};
const map=container('drcProvinceMap',[24,248,428,322],{
  visualType:'shapeMap',drillFilterOtherVisuals:true,
  projections:{Category:[{queryRef:'Health zones.Province',active:true}],Value:[{queryRef:'Case changes.Net reported cases'}]},
  prototypeQuery:{Version:2,From:[{Name:'h',Entity:'Health zones',Type:0},{Name:'c',Entity:'Case changes',Type:0}],Select:[{...province,Name:'Health zones.Province',NativeReferenceName:'Province'},{...netCases,Name:'Case changes.Net reported cases',NativeReferenceName:'Net reported cases'}]},
  objects:{
    shape:obj({map:{geoJson:{type:lit('packaged'),name:lit(resourceName),content:{expr:{ResourcePackageItem:{PackageName:'RegisteredResources',PackageType:1,ItemName:resourceName}}}}},projectionEnum:lit('mercator')}),
    dataPoint:obj({defaultColor:fill('#E65B65'),fillRule:{linearGradient2:{min:{color:lit('#E65B65')},max:{color:lit('#E65B65')},nullColoringStrategy:{strategy:lit('asZero')}}}}),
    defaultColors:obj({defaultShow:lit(true),defaultColor:fill('#404248'),borderColor:fill('#73757C'),borderThickness:lit(0.7)}),
    zoom:obj({autoZoom:lit(false),selectionZoom:lit(false),manualZoom:lit(false)}),
    legend:obj({show:lit(false)})
  },
  vcObjects:{title:obj({show:lit(true),text:lit('DRC · provinces with reported cases'),fontSize:lit(12),bold:lit(true),fontColor:fill('#F2F2F2')}),background:obj({show:lit(true),color:fill('#202020'),transparency:lit(0)}),border:obj({show:lit(true),color:fill('#343434'),radius:lit(7)}),visualHeader:obj({show:lit(false)})}
});
const legend=container('drcProvinceMapLegend',[24,578,428,62],{
  visualType:'textbox',objects:{general:obj({paragraphs:[{textRuns:[{value:'Red: provinces in selection. Click to explore.',textStyle:{fontFamily:'Segoe UI',fontSize:'11pt',color:'#B7BBC1'}}]}]})},
  vcObjects:{background:obj({show:lit(true),color:fill('#121212'),transparency:lit(0)}),border:obj({show:lit(false)}),visualHeader:obj({show:lit(false)})}
});
page.visualContainers=page.visualContainers.filter(v=>!['drcProvinceMap','drcProvinceMapLegend'].includes(JSON.parse(v.config).name));
page.visualContainers.push(map,legend);
for(const v of page.visualContainers)if(v.x<0||v.y<0||v.x+v.width>1280||v.y+v.height>720)throw new Error('Visual outside canvas');
const rc=JSON.parse(report.config);rc.activeSectionIndex=report.sections.indexOf(page);report.config=json(rc);
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
if(hash(modelPath)!==modelHash)throw new Error('Model unexpectedly changed');
const metadata={
  source:'Province Boundary - Democratic Republic of the Congo - Administrative Boundaries (2017)',
  publisher:'OCHA / UNDP boundary attributes; distributed by World Bank ENERGYDATA.INFO, curated from HDX',
  sourcePage:'https://energydata.info/dataset/democratic-republic-congo-administrative-boundaries-2017/resource/659b9621-1036-43e5-a90e-4180969a2ab5',
  downloadURL:'https://datacatalogfiles.worldbank.org/ddh-published/0040240/1/DR0050122/codadmbndaadm120170407.geojson',
  license:'Creative Commons Attribution 4.0 (distributor metadata)',retrieved:'2026-09-18',
  rawSHA256:hash(rawPath),features:26,affectedProvinces:affected,bbox,aliases,
  preprocessing:'Removed the exact trailing export artifact System.IO.MemoryStream from the derived copy; source preserved. Province names normalized for joins. Geometry and coordinates unchanged; lossless unquantized TopoJSON conversion.',
  reportingCutoff:'2020-01-26',interpretation:'Province-level reporting in the current selection, not local transmission extent. Gray provinces are geographic context, not a claim about every outbreak.'
};
fs.writeFileSync(path.join(maps,'map_source.json'),JSON.stringify(metadata,null,2)+'\n');
const manifestPath=path.join(root,'data/source_manifest.json');
if(fs.existsSync(manifestPath)){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const entry={name:metadata.source,url:metadata.sourcePage,downloadURL:metadata.downloadURL,publisher:metadata.publisher,license:metadata.license,local:'maps/drc_provinces_2017.geojson',sha256:metadata.rawSHA256,details:'maps/map_source.json'};
  manifest.sources=manifest.sources.filter(s=>s.local!==entry.local);
  manifest.sources.push(entry);
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({features:26,affectedProvinces:affected,coordinateCount:points.length,bbox,modelUnchanged:true,visuals:page.visualContainers.length,topologyBytes:Buffer.byteLength(json(topology))},null,2));
