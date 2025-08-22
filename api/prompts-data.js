// api/prompts-data.js
const ALBO_PROMPTS = [
  {
    id: "ctrl-001",
    title: "Business Case für Produktinvestitionen",
    role: "Controller",
    category: "Investment & Business Cases",
    complexity: "high",
    estimatedTime: "25 min",
    description: "Erstellt einen vollständigen Business Case mit NPV, IRR, Amortisation und Entscheidungsvorlage für CAPEX-Freigaben",
    tags: ["CAPEX", "NPV", "IRR", "Investment", "Business Case"],
    
    questions: [
      {
        id: "investment_object",
        label: "Was ist der Investitionsgegenstand?",
        type: "text",
        required: true,
        placeholder: "z.B. CNC-Fräse für Produktlinie XY"
      },
      {
        id: "investment_volume",
        label: "Investitionsvolumen (€)",
        type: "number",
        required: true,
        placeholder: "850000"
      },
      {
        id: "calculation_period",
        label: "Berechnungszeitraum",
        type: "select",
        required: true,
        options: ["3 Jahre", "5 Jahre", "8 Jahre", "10 Jahre"]
      },
      {
        id: "expected_returns",
        label: "Jährliche Erlöse/Einsparungen (€)",
        type: "number",
        required: true,
        placeholder: "180000"
      },
      {
        id: "discount_rate",
        label: "Kalkulationszins (%)",
        type: "number",
        required: true,
        defaultValue: "6"
      }
    ],
    
    promptTemplate: `Du bist ein erfahrener Controller mit Spezialisierung auf Investitionsrechnungen.

INVESTITIONSDATEN:
- Investitionsgegenstand: {{investment_object}}
- Investitionsvolumen: {{investment_volume}} €
- Berechnungszeitraum: {{calculation_period}}
- Erwartete jährliche Erlöse/Einsparungen: {{expected_returns}} €
- Kalkulationszins: {{discount_rate}}%

AUFGABE:
1. Erstelle eine Cashflow-Tabelle über die Laufzeit
2. Berechne Kapitalwert (NPV), internen Zinsfuß (IRR), Amortisationsdauer
3. Bewerte die Investition qualitativ
4. Gib eine klare Empfehlung

FORMAT:
- Professionelle Tabellen
- Klare Kennzahlen
- Executive Summary
- Entscheidungsempfehlung`
  }
];

module.exports = ALBO_PROMPTS;