Mission : Transformer le cœur de SoryOS-Code en un agent de développement de haut niveau

Tu es l'ingénieur principal responsable de l'architecture et de l'amélioration complète du cœur agentique de SoryOS-Code.

1. Objectif principal

Fais évoluer le cœur de SoryOS-Code pour qu'il puisse rivaliser avec les meilleurs agents de développement, notamment :

- OpenAI Codex Desktop et Codex CLI
- OpenCode et son interface desktop
- Gemini CLI
- Les agents modernes de développement autonomes

Ne te contente pas d'imiter leurs interfaces. Étudie les principes architecturaux pertinents, puis implémente une architecture originale, robuste, extensible et réellement fonctionnelle.

L'objectif est de faire de SoryOS-Code un agent capable de comprendre, planifier, coder, exécuter, tester, corriger et expliquer ses changements dans un projet réel.

2. Auditer le code existant avant toute modification

Commence par analyser l'ensemble du dépôt :

- Le moteur principal de l'agent.
- La boucle d'exécution et la gestion des messages.
- Les fournisseurs IA et leurs adaptateurs.
- Le système de tools et de tool cards.
- Les outils de lecture, création, modification et suppression de fichiers.
- Le terminal et l'exécution des commandes.
- La gestion des sessions, de la mémoire et du contexte.
- Les systèmes de permissions et de validation.
- Les environnements Local et Sandbox et leurs providers.
- Les mécanismes de streaming, d'annulation, de reprise et de gestion des erreurs.
- Les tests existants et les fonctionnalités inachevées.

Identifie les problèmes réels à partir du code. Ne suppose pas qu'une fonctionnalité existe parce que son interface est présente.

Préserve les fonctionnalités déjà opérationnelles et évite de réécrire inutilement tout le projet.

3. Construire un véritable Agent Runtime

Implémente ou améliore un moteur central organisé autour d'une boucle d'exécution fiable :

1. Recevoir la demande de l'utilisateur.
2. Analyser le workspace et récupérer le contexte utile.
3. Construire un plan d'action lorsque la tâche le nécessite.
4. Envoyer au fournisseur IA le contexte et les outils disponibles.
5. Interpréter les réponses et les appels d'outils structurés.
6. Exécuter les outils avec validation des arguments et permissions.
7. Retourner les résultats des outils au modèle.
8. Continuer jusqu'à l'achèvement réel de la tâche ou une limite explicite.
9. Vérifier les modifications et lancer les tests pertinents.
10. Présenter un bilan fidèle des changements, des tests et des erreurs restantes.

Le runtime doit prendre en charge les appels d'outils successifs, plusieurs étapes de raisonnement, les erreurs récupérables, les limites d'exécution, l'annulation et la reprise lorsque cela est techniquement possible.

Ne prétends jamais qu'une tâche est terminée si les opérations nécessaires n'ont pas été exécutées ou vérifiées.

4. Créer un système de tools professionnel

Conçois un registre de tools avec des schémas d'entrée validés, des descriptions claires, des résultats structurés, des permissions et une gestion uniforme des erreurs.

Les outils doivent notamment couvrir :

- Lecture et recherche de fichiers.
- Exploration de l'arborescence.
- Recherche de symboles et de références.
- Modification précise de fichiers et application de patchs.
- Exécution de commandes dans le bon environnement.
- Tests, lint, vérification de types et compilation.
- Git : état, diff et historique utile.
- Consultation de documentation lorsque des sources fiables sont disponibles.
- Sous-tâches spécialisées lorsque leur utilisation apporte un avantage réel.

Les tool cards de l'interface doivent représenter les véritables exécutions du runtime, avec les arguments autorisés, l'état, la sortie et les erreurs. Ne crée pas de fausses cartes décoratives.

Protège les fichiers sensibles, limite les accès au workspace et exige une confirmation pour les opérations destructrices ou risquées.

5. Améliorer l'intelligence de travail sur les projets

L'agent doit pouvoir :

- Comprendre un dépôt avant de modifier son code.
- Détecter les langages, frameworks, commandes de build et tests disponibles.
- Identifier les fichiers concernés par une demande.
- Élaborer un plan proportionné à la complexité de la tâche.
- Réutiliser les conventions et l'architecture déjà présentes.
- Modifier plusieurs fichiers de manière cohérente.
- Détecter les erreurs provoquées par ses propres changements.
- Corriger ces erreurs et relancer les vérifications pertinentes.
- Éviter les modifications inutiles et les réécritures massives.
- Fournir des résumés de progression précis.

Pour les tâches complexes, implémente une stratégie de planification, d'exécution par étapes et de vérification. Pour les tâches simples, évite une orchestration inutilement lourde.

6. Contexte, mémoire et sessions

Améliore la gestion du contexte pour les longues sessions :

- Historique des conversations et des tool calls.
- Résumés de contexte lorsque la fenêtre de tokens devient limitée.
- Mémoire de session persistante.
- Indexation ou recherche du code lorsque cela est utile.
- Conservation des décisions et des contraintes du projet.
- Reprise cohérente après une interruption.
- Isolation des sessions et des workspaces.
- Traçabilité des actions effectuées.

Utilise la base de données et les technologies déjà présentes lorsque cela est pertinent. Évite de stocker inutilement des secrets ou de mélanger les données de différentes sessions.

7. Architecture des modèles et des fournisseurs

Construis une interface commune aux fournisseurs IA, sans coupler le runtime à un seul modèle.

Prends en charge les capacités réellement disponibles chez chaque fournisseur : streaming, appels d'outils, sorties structurées, limites de contexte et erreurs.

Les fournisseurs OpenAI, Gemini, Mistral et OpenRouter doivent être intégrés uniquement selon les SDK et API réellement compatibles avec leurs capacités.

Prévois :

- Une gestion sécurisée des clés API.
- Des erreurs explicites de configuration et d'authentification.
- Des délais d'attente et une gestion des limites de débit.
- Des tentatives de reprise contrôlées.
- Une compatibilité avec plusieurs modèles.
- Des tests avec des réponses simulées, puis des tests d'intégration quand les clés sont disponibles.

N'invente pas des capacités d'API et ne prétends pas qu'un fournisseur fonctionne sans l'avoir testé.

8. Environnements d'exécution

Respecte l'architecture existante :

Project → Workspace → Session → Environment → Execution Provider.

Prends en charge les environnements Local et Sandbox sans confondre leurs fichiers, leurs terminaux ni leurs commandes.

Assure-toi que l'agent, les tools, le terminal et les tests utilisent le même environnement actif. Signale clairement les providers non configurés.

N'effectue aucune synchronisation silencieuse entre la machine locale et un environnement cloud.

9. Fiabilité, sécurité et tests

Ajoute des tests automatisés pour :

- La boucle d'agent et les appels d'outils.
- Les réponses invalides du modèle.
- Les erreurs de providers.
- Les modifications de fichiers et les patchs.
- L'annulation et les limites d'exécution.
- Les permissions et les commandes dangereuses.
- L'isolation des sessions.
- Les environnements Local et Sandbox.
- Les scénarios de correction après échec d'un test.

Ajoute des logs structurés et des identifiants de corrélation pour diagnostiquer les problèmes. Ne journalise pas les clés API ni les secrets.

Mesure la fiabilité, le taux de réussite des tâches, le nombre d'erreurs récupérées et les coûts ou tokens consommés lorsque ces informations sont disponibles.

10. Contraintes impératives

- Travaille dans le dépôt existant de SoryOS-Code.
- Respecte sa stack et ses conventions actuelles.
- Ne migre pas tout le moteur vers Rust, Python ou une autre technologie sans justification et validation de compatibilité.
- Ne supprime pas les fonctionnalités existantes sans raison démontrée.
- N'ajoute pas de dépendances inutiles.
- Ne remplace pas le moteur par une simple suite de prompts.
- N'implémente pas de fausses intégrations ni de simulations présentées comme réelles.
- Ne laisse pas de fonctions essentielles sous forme de TODO.
- Ne désactive pas les tests pour faire passer le build.
- Ne te contente pas de produire un rapport ou un plan : implémente les améliorations dans le code.

11. Méthode de travail obligatoire

Procède par phases :

Phase A — Audit : cartographie l'architecture, identifie les bugs et établis les priorités.

Phase B — Fondations : corrige les défauts du runtime, des providers et des tools.

Phase C — Intelligence : améliore le contexte, la planification, l'exécution multi-étapes et la correction autonome.

Phase D — Fiabilité : ajoute les tests, les protections et la gestion des erreurs.

Phase E — Validation : lance les tests, le lint, la vérification des types et le build appropriés au projet.

Après chaque phase, explique les changements réellement effectués, les fichiers touchés et les résultats des tests. Corrige les régressions avant de poursuivre.

Si la tâche dépasse la durée d'une session, conserve un état de progression exploitable et reprends à partir du dernier point vérifié.

Résultat attendu

À la fin, SoryOS-Code doit disposer d'un cœur d'agent modulaire et testable, capable d'exécuter des tâches de développement de bout en bout, d'utiliser réellement ses outils, de travailler sur plusieurs fichiers, de vérifier ses changements et de récupérer des erreurs sans tromper l'utilisateur.

Commence maintenant par l'audit du dépôt, puis passe directement à l'implémentation. Ne t'arrête pas après avoir rédigé le plan.