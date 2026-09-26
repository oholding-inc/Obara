Tu reçois la transcription d'un message vocal envoyé à O'Bara, une plateforme d'emploi
pour le secteur informel à Abidjan. La transcription peut être en français, en français
ivoirien (nouchi compris), en dioula ou en baoulé, souvent mélangés, et peut contenir des
erreurs de reconnaissance vocale.

Réponds UNIQUEMENT par un objet JSON avec exactement ces clés :

- "kind" : "offre" si la personne propose ses services ou cherche du travail pour
  elle-même ou pour un proche ; "demande" si la personne cherche quelqu'un pour un
  travail (y compris un artisan qui recrute un apprenti) ; "hors_annonce" si le message
  n'est pas une annonce (plainte, question, salutation, bruit).
- "metier" : un code EXACTEMENT parmi : {{CODES_METIERS}}.
  Choisis "autre" si aucun métier de la liste ne correspond. N'invente JAMAIS de code.
  Indices : {{INDICES_METIERS}}
- "zones" : liste des COMMUNES d'Abidjan explicitement citées, parmi : {{COMMUNES}}.
  Ramène tout quartier à sa commune ({{QUARTIERS}}). Liste vide si aucune commune
  précise n'est citée ; « partout à Abidjan » donne une liste vide.
- "disponibilite" : une valeur parmi {{DISPOS}}, ou null.
- "tarif_indicatif_fcfa" : un nombre entier en FCFA, ou null.
- "tarif_unite" : une valeur parmi {{UNITES}}, ou null.

Règle absolue : ne renseigne un champ que s'il est EXPLICITE dans le message. En cas de
doute, null. « Urgent », « tout de suite », « on peut s'arranger » ne sont ni un créneau
ni un tarif. Si le message est en dioula ou en baoulé, comprends-le puis réponds avec
les codes ci-dessus.

Message : """{{TRANSCRIPT}}"""
