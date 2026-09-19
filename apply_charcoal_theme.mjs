import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Presentation-only transformation: never changes data, queries or measures.
const root = path.dirname(fileURLToPath(import.meta.url));
const themeOnly = process.argv.includes('--theme-only');
const reportPath = path.join(root, 'Ebola DRC.Report/report.json');
const modelPath = path.join(root, 'Ebola DRC.SemanticModel/model.bim');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const modelHash = hash(modelPath);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const C = {canvas:'#121212',panel:'#202020',text:'#F2F2F2',muted:'#B7BBC1',line:'#343434',cases:'#AEB0B7',red:'#E65B65'};
const colorMap = {'#122C3A':C.canvas,'#007F83':C.cases,'#D0D1D4':C.cases,'#D27C32':C.text,'#BC4B51':C.red,'#193746':C.text,'#586D78':C.muted,'#F0F4F6':C.canvas,'#FFFFFF':C.text,'#D9E3E8':C.line,'#769AA6':C.muted};
const literal = v => ({expr:{Literal:{Value:typeof v==='string'?`'${v.replaceAll("'","''")}'`:typeof v==='boolean'?String(v):`${v}D`}}});
const fill = c => ({solid:{color:literal(c)}});
const obj = properties => [{properties}];
function recolor(value) {
  if (typeof value === 'string') return value.replace(/#[0-9a-f]{6}/gi, hex=>colorMap[hex.toUpperCase()]??hex);
  if (Array.isArray(value)) return value.map(recolor);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,recolor(v)]));
  return value;
}
function setObject(objects, key, properties) {
  objects[key] ??= obj({});
  Object.assign(objects[key][0].properties, properties);
}
function textOf(sv) {
  return (sv.objects?.general?.[0]?.properties?.paragraphs??[]).map(p=>(p.textRuns??[]).map(r=>r.value??'').join('')).join('\n');
}
function updatePosition(v,c,box) {
  const [x,y,width,height]=box;
  Object.assign(v,{x,y,width,height});
  for (const l of c.layouts??[]) Object.assign(l.position,{x,y,width,height});
}
function headingAccent(page) {
  const name=`charcoalAccent${page.name}`;
  if (page.visualContainers.some(v=>JSON.parse(v.config).name===name)) return;
  const position={x:24,y:18,z:90000,width:5,height:40,tabOrder:90000};
  const config={name,layouts:[{id:0,position}],singleVisual:{
    visualType:'textbox',
    objects:{general:obj({paragraphs:[{textRuns:[{value:''}]}]})},
    vcObjects:{
      background:obj({show:literal(true),color:fill(C.red),transparency:literal(0)}),
      border:obj({show:literal(false)}),visualHeader:obj({show:literal(false)})
    }
  }};
  page.visualContainers.push({...position,filters:'[]',config:JSON.stringify(config)});
}
const querySignatures = r => r.sections.flatMap(p=>p.visualContainers.map(v=>{
  const c=JSON.parse(v.config); return c.singleVisual?.prototypeQuery?JSON.stringify({name:c.name,query:c.singleVisual.prototypeQuery,projections:c.singleVisual.projections,filters:v.filters}):null;
})).filter(Boolean).sort();
const beforeQueries=querySignatures(report);
let removedFooter=0;
for (const page of report.sections) {
  const pc=recolor(JSON.parse(page.config??'{}'));
  pc.objects??={};
  setObject(pc.objects,'background',{color:fill(C.canvas),transparency:literal(0)});
  page.config=JSON.stringify(pc);
  page.visualContainers=page.visualContainers.filter(v=>{
    const text=textOf(JSON.parse(v.config).singleVisual);
    if (text.includes('Detailed source references and quality exceptions:')) {removedFooter++;return false;}
    return true;
  });
  for (const v of page.visualContainers) {
    const c=recolor(JSON.parse(v.config));
    if(c.name.startsWith('charcoalAccent')) continue;
    const sv=c.singleVisual;
    if (!sv) continue;
    sv.objects??={};sv.vcObjects??={};
    const type=sv.visualType;
    const text=textOf(sv);
    const header=type==='textbox'&&v.y===0;
    const bodyPanel=type==='textbox'&&v.y>=260&&v.y<640;
    setObject(sv.vcObjects,'background',{show:literal(true),color:fill(type==='textbox'&&!bodyPanel?C.canvas:C.panel),transparency:literal(0)});
    setObject(sv.vcObjects,'border',{show:literal(type!=='textbox'||bodyPanel),color:fill(C.line),radius:literal(7)});
    setObject(sv.vcObjects,'visualHeader',{show:literal(false)});
    if (sv.vcObjects.title) setObject(sv.vcObjects,'title',{fontColor:fill(C.text),fontFamily:literal('Segoe UI'),bold:literal(true)});
    if (header) {
      updatePosition(v,c,[44,8,1212,64]);
      for(const p of sv.objects.general[0].properties.paragraphs) for(const run of p.textRuns??[]) {
        if (text==='OUTBREAK OVERVIEW') run.value='EBOLA IN DRC';
        run.textStyle={...run.textStyle,fontFamily:'Segoe UI',fontSize:'28pt',fontWeight:'bold',color:C.text};
      }
    }
    if (bodyPanel) {
      for(const p of sv.objects.general[0].properties.paragraphs) for(const run of p.textRuns??[]) {
        run.value=run.value?.replace('The Andersen Lab README describes a longer period than the downloaded CSV. This report follows the actual file coverage.','Source documentation describes a longer period than the available health-zone series. This report follows the actual data coverage.');
        run.textStyle={...run.textStyle,fontFamily:'Segoe UI',color:C.text};
      }
    }
    if (type==='card') {
      const fields=JSON.stringify(sv.projections);
      const red=/Final deaths|Negative revision records/.test(fields);
      setObject(sv.objects,'labels',{color:fill(red?C.red:C.text),fontSize:literal(32)});
      setObject(sv.vcObjects,'title',{fontColor:fill(C.muted),fontSize:literal(12)});
    }
    if (/Chart$/.test(type)) {
      for(const key of ['categoryAxis','valueAxis']) setObject(sv.objects,key,{labelColor:fill(C.muted),gridlineColor:fill(C.line)});
      setObject(sv.objects,'legend',{labelColor:fill(C.muted)});
      setObject(sv.objects,'labels',{color:fill(C.text)});
    }
    if (type==='slicer') {
      // Explicit item surfaces keep both the closed slicer and dropdown readable.
      setObject(sv.objects,'items',{fontColor:fill(C.text),background:fill(C.panel),textSize:literal(11)});
      setObject(sv.objects,'header',{fontColor:fill(C.text),background:fill(C.panel)});
    }
    v.config=JSON.stringify(c);
  }
  headingAccent(page);
}
report.sections.sort((a,b)=>(a.ordinal??0)-(b.ordinal??0));
const rc=JSON.parse(report.config);rc.activeSectionIndex=0;report.config=JSON.stringify(rc);
const solid=c=>({solid:{color:c}});
const theme={name:'Ebola DRC - Charcoal and Red',dataColors:[C.cases,C.red,'#A1A1AA','#F2F2F2','#8B4047'],background:C.panel,foreground:C.text,tableAccent:C.red,
  visualStyles:{'*':{'*':{
    outspacePane:[{backgroundColor:solid(C.panel),transparency:0,border:true,borderColor:solid(C.line)}],
    filterCard:[
      {$id:'Applied',backgroundColor:solid(C.panel),foregroundColor:solid(C.text),transparency:0,border:true},
      {$id:'Available',backgroundColor:solid(C.panel),foregroundColor:solid(C.text),transparency:0,border:true}
    ]
  }}}
};
const themeName=path.basename(rc.themeCollection.customTheme.name);
for(const themePath of (themeOnly?['EbolaDRC-theme.json']:['EbolaDRC-theme.json',`Ebola DRC.Report/StaticResources/RegisteredResources/${themeName}`])) fs.writeFileSync(path.join(root,themePath),JSON.stringify(theme,null,2)+'\n');
if (JSON.stringify(beforeQueries)!==JSON.stringify(querySignatures(report))) throw new Error('Unexpected query or filter change');
for(const p of report.sections) for(const v of p.visualContainers) if(v.x<0||v.y<0||v.x+v.width>p.width||v.y+v.height>p.height) throw new Error('Visual outside canvas');
if(hash(modelPath)!==modelHash) throw new Error('Unexpected model change');
if(!themeOnly) fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({themeOnly,pages:report.sections.length,removedFooter,queriesUnchanged:true,modelUnchanged:true,modelHash,palette:C},null,2));
