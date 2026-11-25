const groups = {1:'À présenter en premier',2:'Projets complémentaires',3:'Autres projets et exercices',F:'Forks et projets amont'};
const covers = new Set(['LBaraka','Mahsoul','WealthWave']);
const byId = id => document.getElementById(id);
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(label,url) {
  const a=node('a',label); a.href=url; return a;
}
function project(item,featured) {
  const article=node('article',null,featured?'feature':'row');
  if(featured){
    const image=node('img'); image.src='images/'+item.nom+'.jpg'; image.alt='Capture de la démo '+item.nom;
    image.width=1200; image.height=720; article.append(image);
  }
  const title=node('h3',item.nom);
  const meta=node('p',[item.taille,item.langage].filter(Boolean).join(' · '),'meta');
  const description=node('p',item.description,'summary'), links=node('div',null,'links');
  links.append(link(item.acces,item.url),link('Dépôt',item.depot));
  if(featured){const copy=node('div',null,'copy');copy.append(title,meta,description,links);article.append(copy);}
  else {const heading=node('div');heading.append(title,meta);article.append(heading,description,links);}
  return article;
}
const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function start() {
  const response=await fetch('projets.json');if(!response.ok)throw new Error();
  const items=await response.json();
  const params=new URLSearchParams(location.search);
  for(const id of ['q','priority','size']) byId(id).value=params.get(id)||'';
  function render(){
    const query=fold(byId('q').value.trim());
    const selection=items.filter(p=>(!byId('priority').value||p.priorite===byId('priority').value)&&(!byId('size').value||p.taille===byId('size').value)&&fold([p.nom,p.description,p.langage,p.acces].join(' ')).includes(query));
    const list=byId('results');list.replaceChildren();
    byId('count').textContent=selection.length?selection.length+' projet'+(selection.length>1?'s':''):'Aucun projet ne correspond à ces critères.';
    const url=new URL(location.href);
    for(const id of ['q','priority','size']) {const value=byId(id).value; if(value)url.searchParams.set(id,value);else url.searchParams.delete(id);}
    history.replaceState(null,'',url);
    for(const [key,title] of Object.entries(groups)){
      const group=selection.filter(p=>p.priorite===key);if(!group.length)continue;
      const section=node('section');section.append(node('h2',title));
      const featured=group.filter(p=>covers.has(p.nom));
      if(featured.length){const grid=node('div',null,'features');for(const p of featured)grid.append(project(p,true));section.append(grid);}
      for(const p of group.filter(p=>!covers.has(p.nom)))section.append(project(p,false));
      list.append(section);
    }
  }
  byId('filters').onsubmit=event=>event.preventDefault();
  byId('filters').addEventListener('input',render);render();
}
start().catch(()=>{const fallback=byId('results');fallback.replaceChildren(link('Parcourir le catalogue sur GitHub','https://github.com/Abdelhakim-Baalla/Abdelhakim-Baalla/blob/main/PROJETS.md'));});
