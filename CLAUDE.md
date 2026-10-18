# hablaya

De algemene werkwijze staat in de globale CLAUDE.md (`~/.claude/CLAUDE.md`) en geldt hier ook. Dit bestand bevat alleen wat specifiek is voor dit project.

## Wat is dit project

HablaYa is een webapp (PWA) waarmee Nederlandstaligen Spaans leren in gesproken gesprekken met een AI-tutor. De tutor legt uit in het Nederlands, corrigeert bij het mengen van talen en geeft uitspraaktips. Meer in `ARCHITECTURE.md`.

Doel en doelgroep: nog in te vullen door Carl.

## Stack

- JavaScript/TypeScript; frontend React Native met Expo Router, uitgebracht als web-build (PWA)
- Eén Node-dienst (`server.js`, `node:http`, geen Express) die de web-build (`dist/`) serveert en alle `/api/*`-routes bevat
- OpenAI via één `OPENAI_API_KEY`: spraak naar tekst (Whisper), tutor (GPT-4o-mini) en tekst naar spraak (tts-1)
- PostgreSQL op Railway, directe `pg`-verbinding; eigen aanmelding met JWT (`auth.js`, bcrypt + jsonwebtoken)
- Hosting: Railway (`railway.toml`, `nixpacks.toml`)
- Pakketbeheer: npm
- Distributie: PWA via Safari "Add to Home Screen"; geen App Store en geen native build
- Testen: nog niet ingericht. Meld dat vóór je iets risicovols pusht.
- Linting en formattering: niet geconfigureerd. Voeg dit niet zelf toe zonder akkoord van Carl.

## Projectregels

- Eindgebruikers zijn taalleerders die Spaans oefenen. Houd daar rekening mee bij teksten in de app en bij foutmeldingen.
- De spraakketen (microfoon, Whisper, tutor, tekst naar spraak) is het hart van de app. Haperingen of traagheid daarin zijn een kritiek probleem, geen klein bugje.
- Gebruik geen `Alert.alert` met meerdere knoppen; gebruik `PickerModal` of `ConfirmModal` uit `src/components/` (op web doet `Alert.alert` met meerdere knoppen niets).
- Spraak werkt via tikken om te starten en te stoppen. Voeg geen automatische stemdetectie (VAD) toe; zie `ERRORS.md`.
- Tekst-naar-spraak blijft `tts-1`, gestreamd via `/api/tts`.
- In JSX-tekst echte tekens gebruiken (¡ ¿ á é ñ), geen escape-reeksen.
- Aanmelden is alleen met uitnodigingscode (private beta).

## Uitrol

De verplichte omgevingsvariabelen voor Railway staan in `ARCHITECTURE.md` (sectie "Required env vars"). Sleutels staan nooit in de code.

## Definitie van klaar

Dit project heeft geen geautomatiseerde controle. Klaar betekent daarom dat je
expliciet benoemt wat je hebt gewijzigd, wat je hebt gecontroleerd en wat je niet
hebt kunnen controleren. Zeg nooit "klaar" zonder die derde regel. Als je een
controle nodig hebt die er niet is, meld dat in plaats van eromheen te werken.

Wijzig nooit een test, een assertie of deze definitie zelf om iets groen te krijgen.
Als een test onjuist lijkt, meld dat en laat hem staan.

## Graph Engineering (werkstandaard)

Dit project volgt de Graph Engineering standaard. De graaf staat in `docs/graph/GRAPH.md`,
de anchors in `docs/graph/ANCHORS.md`.

**Voordat je meerstaps-werk uitvoert:**

1. Lees `docs/graph/GRAPH.md`. Bestaat die niet of is die leeg → draai `/graph-scan`
   (bestaand project) of `/graph-init` (nieuw project) vóórdat je begint.
2. Pas de **fake-edge test** toe op de stappen die je van plan bent: laat elke stap
   die het resultaat van de vorige niet nodig heeft parallel lopen.
3. Voor breed werk (>3 onafhankelijke taken): gebruik het diamond-patroon —
   fan out → reduce in code → verify met verse context → synthesize.
4. Een werker beoordeelt nooit zijn eigen werk. De verifier krijgt alleen de
   *bevinding*, nooit de chat van de werker.
5. Bij elke fan-in: tel de inputs tegen het verwachte aantal. Ontbreekt er iets → meld het,
   synthetiseer nooit op een halve set.
6. Respecteer de caps in `GRAPH.md` (max agents, max bestanden, budget). Log elke run in
   `docs/graph/RUNLOG.md`.
7. Respecteer de human gates in `GRAPH.md`: daar stop je en vraag je toestemming.

**Niet grafen:** kleine, geïsoleerde taken, echt sequentieel werk, en verkennend werk
waar je nog niet weet wat je zoekt. Dan is één agent sneller en goedkoper.

### Persoonlijke defaults

<!-- TODO: vul dit één keer in in `Graph enginering\CLAUDE.snippet.md`.
     Daarna draagt elke installatie deze defaults automatisch mee. -->

```text
STANDAARD_HUMAN_GATES:  <waar wil je ALTIJD zelf ja zeggen, in elk project?>
STANDAARD_CAPS:         CAP_FILES <n>, CAP_AGENTS <n>, CAP_ROUNDS <n>
BUDGET_SIGNAAL:         <wanneer moet een run stoppen en jou waarschuwen?>
ALTIJD_BEVROREN:        <wat mag nooit gewijzigd worden, ongeacht project?>
```

## Open punten voor Carl

- `app/(tabs)/subscription.tsx` (regel 50 en 61) gebruikt nog `Alert.alert` met meerdere knoppen, terwijl de regel hierboven dat verbiedt. Nog niet aangepast.
- `package.json` bevat `@supabase/supabase-js` en er bestaat `src/services/supabase.ts`. Of Supabase nog in gebruik is naast de directe `pg`-verbinding is niet vastgesteld.
- De ingecheckte `CLAUDE.md` op `origin/master` bevat tekst van het project Digitale Operator (Scope TMS), niet van HablaYa. Die moet bij het doorvoeren van dit voorstel worden vervangen.
