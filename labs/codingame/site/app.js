const find = id => document.getElementById(id);
const projects = await (await fetch('./projects.json')).json();
const project = projects.find(item => item.id === new URLSearchParams(location.search).get('projet')) || projects[0];
for (const item of projects) {
  const link = document.createElement('a');
  link.href = '?projet=' + item.id;
  link.textContent = item.title;
  if (item.id === project.id) link.setAttribute('aria-current', 'page');
  find('projects').append(link);
}
find('title').textContent = project.title;
find('description').textContent = project.description;
document.title = project.title + ' · Atelier CodinGame';
find('source').href = 'https://github.com/Abdelhakim-Baalla/' + project.id + '/blob/' + project.rev + '/solution.js';
for (const item of project.cases) find('example').add(new Option(item.name));
let active, timer;
function stop() { clearTimeout(timer); active?.terminate(); find('run').disabled = false; }
function showStatus(message, error = false) {
  find('status').textContent = message;
  find('status').toggleAttribute('data-error', error);
}
function execute() {
  stop();
  const item = project.cases[find('example').selectedIndex];
  const input = find('input').value.trimEnd();
  if (!input) { find('result').textContent = ''; showStatus('Saisir un cas de test.', true); return; }
  active = new Worker('./runner.js');
  find('run').disabled = true;
  find('result').textContent = '';
  showStatus('Exécution en cours…');
  timer = setTimeout(() => { stop(); showStatus('Limite de deux secondes atteinte.', true); },2000);
  active.onerror = () => { stop(); showStatus('Impossible de charger le solveur.',true); };
  active.onmessage = ({data}) => {
    stop();
    if (data.error) { showStatus(data.error,true); return; }
    find('result').textContent = data.output;
    if (input === item.input && item.expected !== null) {
      const matches = data.output.trimEnd() === item.expected.trimEnd();
      showStatus(matches ? 'Résultat conforme au cas de test.' : 'Résultat attendu : ' + item.expected,!matches);
    } else showStatus('Exécution terminée.');
  };
  active.postMessage({id:project.id,input,interactive:project.interactive});
}
function loadCase() {
  find('input').value = project.cases[find('example').selectedIndex].input;
  execute();
}
find('input').oninput = () => { stop(); find('result').textContent=''; showStatus('Entrée modifiée.'); };
find('example').onchange = loadCase;
find('run').onclick = execute;
loadCase();
