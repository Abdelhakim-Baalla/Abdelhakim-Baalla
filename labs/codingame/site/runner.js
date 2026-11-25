self.onmessage = ({data}) => {
  const lines = data.input.replace(/\r\n/g,'\n').split('\n');
  const end = new Error('Fin des données');
  const complete = new Error('Programme terminé');
  self.process = { exit(code) { if (code) throw new Error('Code de sortie ' + code); throw complete; } };
  const output = [];
  let row = 0;
  self.readline = () => {
    if (row === lines.length) throw end;
    return lines[row++];
  };
  console.log = (...parts) => {
    if (output.length >= 2000) throw new Error('Sortie trop longue');
    output.push(parts.join(' '));
  };
  try {
    importScripts('./solvers/' + data.id + '/solution.js');
  } catch (error) {
    if (error !== complete && (error !== end || !data.interactive || !output.length)) {
      self.postMessage({ error: error.message });
      return;
    }
  }
  self.postMessage({ output: output.join('\n') });
};
