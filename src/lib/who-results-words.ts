// Wörter für den Zugang der DJ-Seite: einfach zu tippen (nur kleine Buchstaben,
// keine Umlaute, 4 bis 10 Buchstaben) und nicht naheliegend (nichts mit Hochzeit,
// Liebe, Musik oder den Namen). Aus dem Admin-Schlüssel wird eines davon
// gewählt, siehe who-results.ts. Neue Wörter nur hinten anhängen: ändert sich
// die Reihenfolge, ändert sich auch das gewählte Wort.
export const RESULTS_WORDS: readonly string[] = [
  // Obst und Pflanzen
  'apfel', 'birne', 'kirsche', 'pflaume', 'zitrone', 'orange', 'banane', 'mango', 'melone', 'traube',
  'himbeere', 'erdbeere', 'brombeere', 'pfirsich', 'aprikose', 'ananas', 'kokos', 'feige', 'dattel', 'mandel',
  'walnuss', 'haselnuss', 'kastanie', 'tulpe', 'nelke', 'lilie', 'narzisse', 'veilchen', 'lavendel', 'margerite',
  'orchidee', 'klee', 'farn', 'moos', 'bambus', 'palme', 'eiche', 'buche', 'birke', 'tanne',
  'fichte', 'linde', 'ahorn', 'weide', 'pappel', 'distel', 'efeu', 'schilf',
  // Tiere
  'hase', 'igel', 'fuchs', 'dachs', 'hirsch', 'elch', 'wolf', 'luchs', 'otter', 'biber',
  'maus', 'pferd', 'esel', 'schaf', 'ziege', 'schwein', 'huhn', 'ente', 'gans', 'schwan',
  'taube', 'spatz', 'meise', 'amsel', 'drossel', 'fink', 'storch', 'kranich', 'reiher', 'adler',
  'falke', 'eule', 'rabe', 'krebs', 'hummer', 'krabbe', 'qualle', 'delfin', 'hai', 'forelle',
  'lachs', 'karpfen', 'hecht', 'frosch', 'schnecke', 'biene', 'hummel', 'wespe', 'ameise', 'grille',
  'libelle', 'pinguin', 'robbe', 'zebra', 'giraffe', 'kamel', 'koala', 'panda', 'tiger', 'leopard',
  // Dinge
  'tisch', 'stuhl', 'lampe', 'kerze', 'spiegel', 'teller', 'tasse', 'gabel', 'messer', 'kanne',
  'flasche', 'korb', 'kiste', 'truhe', 'schloss', 'fenster', 'treppe', 'brunnen', 'turm', 'mauer',
  'garten', 'wiese', 'hecke', 'zaun', 'schaukel', 'ball', 'drachen', 'ballon', 'trommel', 'geige',
  'harfe', 'gitarre', 'klavier', 'glocke', 'uhr', 'kompass', 'anker', 'segel', 'ruder', 'boot',
  'schiff', 'zug', 'bus', 'fahrrad', 'roller', 'schlitten', 'koffer', 'rucksack', 'schirm', 'hut',
  'schal', 'handschuh', 'mantel', 'schuh', 'stiefel', 'kissen', 'decke', 'teppich', 'vorhang', 'laterne',
  // Natur und Orte
  'berg', 'tal', 'fluss', 'bach', 'see', 'meer', 'strand', 'insel', 'duene', 'wald',
  'lichtung', 'wolke', 'nebel', 'regen', 'schnee', 'sturm', 'wind', 'blitz', 'donner', 'regenbogen',
  'sonne', 'mond', 'stern', 'komet', 'planet', 'himmel', 'sommer', 'herbst', 'winter', 'april',
  'juni', 'juli', 'august', 'hafen', 'leuchtturm', 'dorf', 'stadt', 'markt', 'platz', 'allee',
  'pfad', 'quelle', 'grotte', 'vulkan', 'wueste', 'steppe', 'tundra', 'gletscher', 'savanne', 'oase',
  // Essen
  'brot', 'kuchen', 'torte', 'keks', 'honig', 'butter', 'kaese', 'nudel', 'suppe', 'salat',
  'pizza', 'reis', 'bohne', 'erbse', 'linse', 'karotte', 'gurke', 'tomate', 'kartoffel', 'zwiebel',
  'pilz', 'minze', 'zimt', 'vanille', 'praline', 'bonbon', 'eis', 'pudding', 'marmelade', 'waffel',
  // Farben und Stoffe
  'gold', 'silber', 'bronze', 'perle', 'kristall', 'smaragd', 'rubin', 'saphir', 'topas', 'bernstein',
  'koralle', 'jade', 'onyx', 'opal', 'purpur', 'indigo', 'karmin', 'scharlach', 'ocker', 'kupfer',
  'zinn', 'eisen', 'stahl', 'marmor', 'granit', 'schiefer', 'sandstein', 'kreide', 'samt', 'seide',
]
