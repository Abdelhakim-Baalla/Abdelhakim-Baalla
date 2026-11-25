# Atelier CodinGame

Chaque entrée de `site/projects.json` pointe vers un commit précis du dépôt correspondant. Le script récupère le solveur JavaScript original et sa licence. Un Web Worker exécute le solveur avec les données saisies, puis le navigateur compare la sortie à celle du cas de test sélectionné.

Pour reconstruire et publier l’atelier, exécuter `python3 build.py`, puis `npx wrangler deploy` dans ce dossier.
