import { CompanyData, QuarterlyStats, RegressionModel, ScenarioResult } from './types';
import { MONTHS } from './mockData';
import { SupportedLanguage, TRANSLATIONS } from './i18n';

export const sum = (arr: number[]): number => arr.reduce((x, y) => x + y, 0);

export const formatCr = (n: number): string => '₹' + n.toFixed(1) + ' Cr';

export const formatPct = (n: number): string => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

export const getProfits = (company: CompanyData): number[] => {
  return company.rev.map((r, i) => r - (company.exp[i] ?? 0));
};

export const getQuarterlyStats = (company: CompanyData): QuarterlyStats => {
  const r = company.rev;
  const e = company.exp;
  const p = getProfits(company);

  const q = (arr: number[]): [number, number] => [
    sum(arr.slice(-3)),
    sum(arr.slice(-6, -3)),
  ];

  const [rq, rp] = q(r);
  const [eq, ep] = q(e);
  const [pq, pp] = q(p);

  const rg = rp !== 0 ? (rq / rp - 1) * 100 : 0;
  const eg = ep !== 0 ? (eq / ep - 1) * 100 : 0;
  const pg = pp !== 0 ? (pq / pp - 1) * 100 : 0;
  const mg = rq !== 0 ? (pq / rq) * 100 : 0;

  return { rq, rp, eq, ep, pq, pp, rg, eg, pg, mg };
};

export const linearRegression = (y: number[]): RegressionModel => {
  const n = y.length;
  if (n <= 1) return { s: 0, i: y[0] ?? 0 };

  const mx = (n - 1) / 2;
  const my = sum(y) / n;

  let a = 0;
  let b = 0;
  y.forEach((v, i) => {
    a += (i - mx) * (v - my);
    b += (i - mx) ** 2;
  });

  const s = b !== 0 ? a / b : 0;
  const i = my - s * mx;
  return { s, i };
};

export const predict = (m: RegressionModel, x: number): number => {
  return m.i + m.s * x;
};

export const calculateMape = (y: number[]): number => {
  if (y.length < 12) return 0;
  const m = linearRegression(y.slice(0, 9));
  let e = 0;
  for (let i = 9; i < 12; i++) {
    if (y[i] !== 0) {
      e += Math.abs((y[i] - predict(m, i)) / y[i]);
    }
  }
  return (e / 3) * 100;
};

export const getBaselineGrowth = (company: CompanyData): number => {
  const r = company.rev;
  if (!r.length || r[0] === 0) return 0;
  return (Math.pow(r[r.length - 1] / r[0], 1 / (r.length - 1)) - 1) * 100;
};

export const computeScenario = (company: CompanyData, growthRate: number): ScenarioResult => {
  const r = company.rev;
  const ex = company.exp;
  const last3Rev = sum(r.slice(-3));
  const ratio = last3Rev !== 0 ? sum(ex.slice(-3)) / last3Rev : 0.8;

  const rv: number[] = [];
  let p = r[r.length - 1] || 0;

  for (let i = 0; i < 6; i++) {
    p *= 1 + growthRate / 100;
    rv.push(p);
  }

  return {
    rev: rv,
    prof: rv.map((v) => v * (1 - ratio)),
  };
};

export const answerQuery = (
  company: CompanyData,
  q: string,
  lang: SupportedLanguage = 'en'
): { answer: string; source: string | null } => {
  const query = q.trim();
  if (!query) return { answer: '', source: null };

  const s = getQuarterlyStats(company);
  const l = query.toLowerCase();
  const n = company.n;
  const r = company.rev;

  const tDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const localizedMonths = tDict.months || MONTHS;

  let answer: string;
  let source: string | null = `${tDict.kpiTableSource.replace('{name}', n)}`;

  // Multi-lingual regex matching
  const isForecast = /forecast|next month|predict|予測|翌月|prévision|mois prochain|पूर्वानुमान|अगले महीने/.test(l);
  const isMargin = /margin|利益率|マージン|marge|मार्जिन/.test(l);
  const isPeak = /high|best|peak|最高|最も|élevé|meilleur|सर्वश्रेष्ठ|अधिक/.test(l);
  const isProfit = /profit|利益|純利益|bénéfice|लाभ|फायदा/.test(l);
  const isExpense = /expens|cost|費用|コスト|dépense|coût|खर्च|लागत/.test(l);
  const isRevenue = /revenue|sales|売上|chiffre d’affaires|revenu|राजस्व|बिक्री/.test(l);

  if (isForecast) {
    const nextPred = predict(linearRegression(r), 12);
    source = tDict.forecastModelSource;

    if (lang === 'ja') {
      answer = `線形トレンド予測モデルによると、翌月の売上高は ${formatCr(nextPred)} と見込まれます。`;
    } else if (lang === 'fr') {
      answer = `Le modèle à tendance linéaire projette un chiffre d’affaires de ${formatCr(nextPred)} pour le mois prochain.`;
    } else if (lang === 'hi') {
      answer = `रैखिक रुझान मॉडल अगले महीने के लिए ${formatCr(nextPred)} के राजस्व का अनुमान लगाता है।`;
    } else {
      answer = `The linear-trend model projects next-month revenue of ${formatCr(nextPred)}.`;
    }
  } else if (isMargin) {
    if (lang === 'ja') {
      answer = `前四半期の純利益率は ${s.mg.toFixed(1)}% です（売上高 ${formatCr(s.rq)} に対し利益 ${formatCr(s.pq)}）。`;
    } else if (lang === 'fr') {
      answer = `La marge bénéficiaire du dernier trimestre est de ${s.mg.toFixed(1)}% (bénéfice de ${formatCr(s.pq)} sur des revenus de ${formatCr(s.rq)}).`;
    } else if (lang === 'hi') {
      answer = `पिछली तिमाही का लाभ मार्जिन ${s.mg.toFixed(1)}% है (${formatCr(s.rq)} के राजस्व पर ${formatCr(s.pq)} का लाभ)।`;
    } else {
      answer = `Last-quarter profit margin is ${s.mg.toFixed(1)}% (profit ${formatCr(s.pq)} on revenue ${formatCr(s.rq)}).`;
    }
  } else if (isPeak) {
    const maxVal = Math.max(...r);
    const bestIndex = r.indexOf(maxVal);
    const mName = localizedMonths[bestIndex] || MONTHS[bestIndex];

    if (lang === 'ja') {
      answer = `${mName}が最高売上高 ${formatCr(maxVal)} を記録しました。`;
    } else if (lang === 'fr') {
      answer = `${mName} a enregistré le chiffre d’affaires le plus élevé avec ${formatCr(maxVal)}.`;
    } else if (lang === 'hi') {
      answer = `${mName} में सबसे अधिक राजस्व ${formatCr(maxVal)} दर्ज किया गया था।`;
    } else {
      answer = `${mName} had the highest revenue at ${formatCr(maxVal)}.`;
    }
  } else if (isProfit) {
    if (lang === 'ja') {
      answer = `前四半期の純利益は ${formatCr(s.pq)} で、前々四半期の ${formatCr(s.pp)} に対し変動率は ${formatPct(s.pg)} でした。`;
    } else if (lang === 'fr') {
      answer = `Le bénéfice était de ${formatCr(s.pq)} au dernier trimestre contre ${formatCr(s.pp)} le trimestre précédent (${formatPct(s.pg)}).`;
    } else if (lang === 'hi') {
      answer = `पिछली तिमाही में लाभ ${formatCr(s.pq)} था जबकि पूर्व तिमाही में ${formatCr(s.pp)} था (${formatPct(s.pg)})।`;
    } else {
      answer = `Profit was ${formatCr(s.pq)} last quarter versus ${formatCr(s.pp)} the quarter before (${formatPct(s.pg)}).`;
    }
  } else if (isExpense) {
    if (lang === 'ja') {
      answer = `前四半期の費用は ${formatCr(s.eq)} で、前々四半期比は ${formatPct(s.eg)} でした。`;
    } else if (lang === 'fr') {
      answer = `Les dépenses étaient de ${formatCr(s.eq)} au dernier trimestre, soit ${formatPct(s.eg)} par rapport au trimestre précédent.`;
    } else if (lang === 'hi') {
      answer = `पिछली तिमाही में खर्च ${formatCr(s.eq)} था, पूर्व तिमाही की तुलना में ${formatPct(s.eg)}।`;
    } else {
      answer = `Expenses were ${formatCr(s.eq)} last quarter, ${formatPct(s.eg)} vs the previous quarter.`;
    }
  } else if (isRevenue) {
    if (lang === 'ja') {
      answer = `前四半期の売上高は ${formatCr(s.rq)} で、前々四半期の ${formatCr(s.rp)} に対し ${formatPct(s.rg)} でした。`;
    } else if (lang === 'fr') {
      answer = `Le chiffre d’affaires au dernier trimestre était de ${formatCr(s.rq)}, soit ${formatPct(s.rg)} par rapport au trimestre précédent (${formatCr(s.rp)}).`;
    } else if (lang === 'hi') {
      answer = `पिछली तिमाही का राजस्व ${formatCr(s.rq)} था, पूर्व तिमाही (${formatCr(s.rp)}) की तुलना में ${formatPct(s.rg)}।`;
    } else {
      answer = `Revenue last quarter was ${formatCr(s.rq)}, ${formatPct(s.rg)} vs the previous quarter (${formatCr(s.rp)}).`;
    }
  } else {
    source = null;
    if (lang === 'ja') {
      answer = '承認された企業データ（売上、費用、利益、マージン、予測）のみ回答可能です。提案された質問を試してください。';
    } else if (lang === 'fr') {
      answer = 'Je ne peux répondre qu’à partir des données d’entreprise approuvées (revenus, dépenses, bénéfices, marges, prévisions). Essayez l’une des questions suggérées.';
    } else if (lang === 'hi') {
      answer = 'मैं केवल स्वीकृत कंपनी डेटा (राजस्व, व्यय, लाभ, मार्जिन, पूर्वानुमान) से उत्तर दे सकता हूँ। कृपया सुझाए गए प्रश्नों में से प्रयास करें।';
    } else {
      answer = 'I can only answer from the approved company data (revenue, expenses, profit, margin, forecast). Try one of the suggested questions.';
    }
  }

  return { answer, source };
};
