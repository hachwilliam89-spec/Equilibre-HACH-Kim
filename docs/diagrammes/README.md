# Diagrammes des retours formateurs

Les fichiers `.puml` sont les sources des diagrammes de séquence. Les images
PNG sont jointes aux pages Confluence « Tests Automatiques » et
« Synchronisation ». Le schéma MongoDB est décrit dans `bdd-mongodb.dot` et
joint à la page « BDD ».

Les séquences ont été régénérées avec PlantUML 1.2026.9 le 20 octobre 2026 :

```bash
java -Djava.awt.headless=true -jar /chemin/plantuml.jar \
  -tpng -charset UTF-8 docs/diagrammes/*.puml
```

Les trois sources `sequence-*.puml` reprennent les séquences de
`docs/synchronisation.md`. Lors d'une correction, mettre à jour les deux
sources, régénérer les PNG, puis remplacer les images sur Confluence.

Le schéma documentaire se régénère avec Graphviz :

```bash
dot -Tpng docs/diagrammes/bdd-mongodb.dot -o docs/diagrammes/bdd-mongodb.png
```

Le diagramme de test US1 utilise un plan de 80 à 75 kg sur 35 jours. Le
diagramme de synchronisation couvre le rejeu après retrait et la saturation
des 500 traces : aucune preuve encore rejouable n'est évincée ; le nouveau
retrait est refusé et l'entrée reste conservée.
