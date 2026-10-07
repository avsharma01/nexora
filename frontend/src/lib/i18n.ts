export type SupportedLanguage = 'en' | 'ja' | 'fr' | 'hi';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

export const TRANSLATIONS = {
  en: {
    // Brand & App
    appName: 'NEXORA',
    appSubtitle: 'AI Company Intelligence Platform',
    currencyUnit: '₹ Cr · last 12 months (synthetic data)',
    syntheticSegmentSplit: 'Synthetic segment split',
    syntheticCostSplit: 'Synthetic cost split',
    lastQuarter: 'Last quarter',

    // Nav
    dash: 'Dashboard',
    kpi: 'Company & KPIs',
    ana: 'Analytics',
    fc: 'Forecast',
    ai: 'AI Analyst',
    wi: 'What-If',
    notAvailableRole: 'Not available for your role',
    signOut: 'Sign out',
    role: 'Role',

    // Status
    backendOnline: 'FastAPI Backend Online',
    standaloneMode: 'Standalone / Mock Mode',
    apiConnected: 'API Connected',
    localEngine: 'Local Engine',

    // Login
    signIn: 'Sign in',
    signingIn: 'Signing in...',
    demoRolesPrompt: 'Demo roles (password demo123):',
    invalidCredentials: 'Invalid credentials',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',

    // Dashboard
    revenueQ: 'Revenue (Q)',
    expensesQ: 'Expenses (Q)',
    profitQ: 'Profit (Q)',
    profitMargin: 'Profit margin',
    vsPrevQuarter: 'vs prev. quarter',
    revVsExp: 'Revenue vs expenses',
    monthlyProfit: 'Monthly profit',
    revMixSegment: 'Revenue mix by segment',
    expenseBreakdown: 'Expense breakdown',
    profitMarginTrend: 'Profit margin trend (%)',
    quarterlyRevVsExp: 'Quarterly revenue vs expenses',
    revenueLegend: 'Revenue',
    expensesLegend: 'Expenses',
    profitLegend: 'Profit',

    // Company & KPIs
    companyProfile: 'Company profile',
    companyName: 'Name',
    sector: 'Sector',
    hq: 'HQ',
    founded: 'Founded',
    employees: 'Employees',
    kpiFinancials: 'KPI / financials',
    adminEditNote: '(admin: edit revenue & expenses)',
    readOnlyNote: '(read-only for {role})',
    monthCol: 'Month',
    revenueCol: 'Revenue',
    expensesCol: 'Expenses',
    profitCol: 'Profit',
    marginCol: 'Margin',

    // Analytics
    growth12Mo: 'Growth, 12-mo',
    qoqRevenue: 'QoQ revenue',
    qoqProfit: 'QoQ profit',
    bestMonth: 'Best month',
    revProfitTrend: 'Revenue & profit trend',
    periodComparison: 'Period comparison (last Q vs previous Q)',
    metricCol: 'Metric',
    prevQCol: 'Prev Q',
    lastQCol: 'Last Q',
    changeCol: 'Change',
    momRevenueGrowth: 'MoM revenue growth',
    positiveGrowth: 'Positive',
    negativeGrowth: 'Negative (magnitude)',

    // Forecast
    model: 'Model',
    linearTrend: 'Linear trend',
    nextMonthRevenue: 'Next-month revenue',
    projected6Mo: '6-mo projected total',
    backtestMape: 'Backtest MAPE',
    revenueForecast6Mo: 'Revenue forecast – next 6 months',
    actualLegend: 'Actual',
    forecastLegend: 'Forecast',
    forecastFootnote: 'Single primary metric (revenue). Evaluation: model fit on first 9 months, tested on last 3 (MAPE).',

    // AI Analyst
    aiTitle: 'Ask the AI Business Analyst',
    aiSubtitle: 'Answers are grounded only in {name}’s approved KPI data.',
    aiEmptyPrompt: 'Pick a question below or type your own.',
    askInputPlaceholder: 'Ask about revenue, profit, margin, forecast…',
    askButton: 'Ask',
    thinking: 'Thinking...',
    sourcePrefix: 'Source: ',
    kpiTableSource: 'KPI table, {name}',
    forecastModelSource: 'Revenue forecast model',

    // What-If
    assumptionGrowth: 'Assumption: monthly revenue growth',
    perMonth: '{val}% / month',
    resetBaseline: 'Reset to baseline',
    baselineNote: 'Baseline = historical average growth ({val}%/mo). Expense ratio held at last-quarter level.',
    rev6Mo: '6-mo revenue',
    prof6Mo: '6-mo profit',
    baselinePrefix: 'Baseline {val}',
    vsBaseline: 'vs baseline',
    baselineVsScenario: 'Baseline vs scenario – revenue',
    baselineLegend: 'Baseline',
    scenarioLegend: 'Scenario',
    baselineRevRow: 'Baseline rev',
    scenarioRevRow: 'Scenario rev',
    scenarioProfitRow: 'Scenario profit',

    // Month abbreviations
    months: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    forecastMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    quarterLabels: ['Oct–Dec', 'Jan–Mar', 'Apr–Jun', 'Jul–Sep'],

    // Suggested Questions
    suggestedQuestions: [
      'What was revenue last quarter?',
      'How did profit change versus the previous quarter?',
      'What is the current profit margin?',
      'Which month had the highest revenue?',
      'What does the forecast say for next month?',
    ],
  },

  ja: {
    // Brand & App
    appName: 'NEXORA',
    appSubtitle: 'AI企業インテリジェンス・プラットフォーム',
    currencyUnit: '₹ クローレ · 過去12ヶ月（合成データ）',
    syntheticSegmentSplit: '合成セグメント内訳',
    syntheticCostSplit: '合成コスト内訳',
    lastQuarter: '前四半期',

    // Nav
    dash: 'ダッシュボード',
    kpi: '企業とKPI',
    ana: 'アナリティクス',
    fc: '業績予測',
    ai: 'AIアナリスト',
    wi: 'What-Ifシミュレーション',
    notAvailableRole: '現在の権限では利用できません',
    signOut: 'ログアウト',
    role: '権限',

    // Status
    backendOnline: 'FastAPI バックエンド接続中',
    standaloneMode: 'スタンドアロン / モックモード',
    apiConnected: 'API接続完了',
    localEngine: 'ローカルエンジン稼働中',

    // Login
    signIn: 'ログイン',
    signingIn: 'ログイン中...',
    demoRolesPrompt: 'デモ用アカウント（パスワード demo123）：',
    invalidCredentials: 'メールアドレスまたはパスワードが無効です',
    emailPlaceholder: 'メールアドレス',
    passwordPlaceholder: 'パスワード',

    // Dashboard
    revenueQ: '四半期売上高',
    expensesQ: '四半期費用',
    profitQ: '四半期利益',
    profitMargin: '利益率',
    vsPrevQuarter: '前四半期比',
    revVsExp: '売上高 vs 費用',
    monthlyProfit: '月次純利益',
    revMixSegment: 'セグメント別売上構成比',
    expenseBreakdown: '費用構成の内訳',
    profitMarginTrend: '利益率の推移 (%)',
    quarterlyRevVsExp: '四半期別 売上高 vs 費用',
    revenueLegend: '売上高',
    expensesLegend: '費用',
    profitLegend: '純利益',

    // Company & KPIs
    companyProfile: '企業プロフィール',
    companyName: '企業名',
    sector: '業種',
    hq: '本社所在地',
    founded: '設立年',
    employees: '従業員数',
    kpiFinancials: '主要財務指標 (KPI)',
    adminEditNote: '(管理者: 売上と費用の編集が可能)',
    readOnlyNote: '({role}権限: 閲覧専用)',
    monthCol: '月',
    revenueCol: '売上高',
    expensesCol: '費用',
    profitCol: '純利益',
    marginCol: '利益率',

    // Analytics
    growth12Mo: '12ヶ月成長率 (YoY)',
    qoqRevenue: '売上前四半期比 (QoQ)',
    qoqProfit: '利益前四半期比 (QoQ)',
    bestMonth: '最高売上月',
    revProfitTrend: '売上と利益のトレンド',
    periodComparison: '期間比較 (前四半期 vs 直前四半期)',
    metricCol: '指標',
    prevQCol: '前々四半期',
    lastQCol: '直近四半期',
    changeCol: '変動率',
    momRevenueGrowth: '前月比売上成長率 (MoM)',
    positiveGrowth: 'プラス成長',
    negativeGrowth: 'マイナス成長 (規模)',

    // Forecast
    model: 'モデル',
    linearTrend: '線形トレンド回帰',
    nextMonthRevenue: '翌月売上高予測',
    projected6Mo: '今後6ヶ月合計予測',
    backtestMape: 'バックテストMAPE誤差',
    revenueForecast6Mo: '売上高予測 – 今後6ヶ月',
    actualLegend: '実績値',
    forecastLegend: '予測値',
    forecastFootnote: '主要指標（売上高）。検証手法: 最初の9ヶ月でフィッティングし、直近3ヶ月でMAPE検証を実施。',

    // AI Analyst
    aiTitle: 'AIビジネスアナリストに相談',
    aiSubtitle: '回答は{name}の承認済みKPIデータのみに基づきます。',
    aiEmptyPrompt: '下記の質問を選択するか、自由に入力してください。',
    askInputPlaceholder: '売上、利益、マージン、予測について質問を入力…',
    askButton: '質問する',
    thinking: '推論中...',
    sourcePrefix: '参照元: ',
    kpiTableSource: 'KPIデータテーブル, {name}',
    forecastModelSource: '売上高線形予測モデル',

    // What-If
    assumptionGrowth: '前提条件: 月次売上高成長率',
    perMonth: '{val}% / 月',
    resetBaseline: '基本予測値にリセット',
    baselineNote: '基本線 = 過去の平均月次成長率 ({val}%/月)。費用比率は直近四半期水準を維持。',
    rev6Mo: '今後6ヶ月売上高',
    prof6Mo: '今後6ヶ月利益',
    baselinePrefix: '基準値 {val}',
    vsBaseline: '基準比',
    baselineVsScenario: '基準予測 vs シナリオ売上',
    baselineLegend: '基準予測',
    scenarioLegend: 'シナリオ',
    baselineRevRow: '基準売上',
    scenarioRevRow: 'シナリオ売上',
    scenarioProfitRow: 'シナリオ利益',

    // Month abbreviations
    months: ['10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月'],
    forecastMonths: ['10月', '11月', '12月', '1月', '2月', '3月'],
    quarterLabels: ['10-12月期', '1-3月期', '4-6月期', '7-9月期'],

    // Suggested Questions
    suggestedQuestions: [
      '前四半期の売上高はいくらでしたか？',
      '前四半期と比較して利益はどう変化しましたか？',
      '直近の利益率は何パーセントですか？',
      '過去12ヶ月で最も売上が高かった月はいつですか？',
      '翌月の売上予測はどうなっていますか？',
    ],
  },

  fr: {
    // Brand & App
    appName: 'NEXORA',
    appSubtitle: 'Plateforme d’Intelligence d’Entreprise IA',
    currencyUnit: '₹ Cr · 12 derniers mois (données synthétiques)',
    syntheticSegmentSplit: 'Répartition synthétique par segment',
    syntheticCostSplit: 'Répartition synthétique des coûts',
    lastQuarter: 'Dernier trimestre',

    // Nav
    dash: 'Tableau de bord',
    kpi: 'Entreprise & KPI',
    ana: 'Analytique',
    fc: 'Prévisions',
    ai: 'Analyste IA',
    wi: 'Simulation What-If',
    notAvailableRole: 'Non disponible pour votre rôle',
    signOut: 'Se déconnecter',
    role: 'Rôle',

    // Status
    backendOnline: 'FastAPI Backend en ligne',
    standaloneMode: 'Mode autonome / Simulé',
    apiConnected: 'API connectée',
    localEngine: 'Moteur local actif',

    // Login
    signIn: 'Se connecter',
    signingIn: 'Connexion...',
    demoRolesPrompt: 'Comptes de démonstration (mot de passe demo123) :',
    invalidCredentials: 'Identifiants invalides',
    emailPlaceholder: 'E-mail',
    passwordPlaceholder: 'Mot de passe',

    // Dashboard
    revenueQ: 'Chiffre d’affaires (T)',
    expensesQ: 'Dépenses (T)',
    profitQ: 'Bénéfice (T)',
    profitMargin: 'Marge bénéficiaire',
    vsPrevQuarter: 'vs trimestre précédent',
    revVsExp: 'Revenus vs dépenses',
    monthlyProfit: 'Bénéfice mensuel',
    revMixSegment: 'Mix de revenus par segment',
    expenseBreakdown: 'Ventilation des dépenses',
    profitMarginTrend: 'Tendance marge bénéficiaire (%)',
    quarterlyRevVsExp: 'Revenus trimestriels vs dépenses',
    revenueLegend: 'Revenus',
    expensesLegend: 'Dépenses',
    profitLegend: 'Bénéfice',

    // Company & KPIs
    companyProfile: 'Profil de l’entreprise',
    companyName: 'Nom',
    sector: 'Secteur',
    hq: 'Siège social',
    founded: 'Fondée en',
    employees: 'Employés',
    kpiFinancials: 'KPIs / Données financières',
    adminEditNote: '(admin: modifier revenus & dépenses)',
    readOnlyNote: '(lecture seule pour {role})',
    monthCol: 'Mois',
    revenueCol: 'Revenus',
    expensesCol: 'Dépenses',
    profitCol: 'Bénéfice',
    marginCol: 'Marge',

    // Analytics
    growth12Mo: 'Croissance sur 12 mois',
    qoqRevenue: 'Revenus QoQ',
    qoqProfit: 'Bénéfice QoQ',
    bestMonth: 'Meilleur mois',
    revProfitTrend: 'Tendance revenus & bénéfice',
    periodComparison: 'Comparaison périodique (Dernier T vs T précédent)',
    metricCol: 'Indicateur',
    prevQCol: 'T précédent',
    lastQCol: 'Dernier T',
    changeCol: 'Variation',
    momRevenueGrowth: 'Croissance mensuelle (MoM)',
    positiveGrowth: 'Positive',
    negativeGrowth: 'Négative (amplitude)',

    // Forecast
    model: 'Modèle',
    linearTrend: 'Tendance linéaire',
    nextMonthRevenue: 'Revenus mois prochain',
    projected6Mo: 'Total projeté sur 6 mois',
    backtestMape: 'MAPE de rétro-test',
    revenueForecast6Mo: 'Prévision de revenus – 6 prochains mois',
    actualLegend: 'Réel',
    forecastLegend: 'Prévision',
    forecastFootnote: 'Indicateur principal (revenus). Évaluation: calage sur 9 premiers mois, test sur 3 derniers (MAPE).',

    // AI Analyst
    aiTitle: 'Consulter l’Analyste Commercial IA',
    aiSubtitle: 'Les réponses reposent exclusivement sur les KPI certifiés de {name}.',
    aiEmptyPrompt: 'Choisissez une question ci-dessous ou saisissez la vôtre.',
    askInputPlaceholder: 'Interrogez sur les revenus, profits, marges, prévisions…',
    askButton: 'Demander',
    thinking: 'Réflexion...',
    sourcePrefix: 'Source: ',
    kpiTableSource: 'Tableau des KPI, {name}',
    forecastModelSource: 'Modèle de prévision des revenus',

    // What-If
    assumptionGrowth: 'Hypothèse: croissance mensuelle des revenus',
    perMonth: '{val}% / mois',
    resetBaseline: 'Réinitialiser la base',
    baselineNote: 'Base = croissance historique moyenne ({val}%/mois). Ratio de dépenses maintenu au niveau du dernier trimestre.',
    rev6Mo: 'Revenus 6 mois',
    prof6Mo: 'Bénéfice 6 mois',
    baselinePrefix: 'Base {val}',
    vsBaseline: 'vs base',
    baselineVsScenario: 'Base vs scénario – revenus',
    baselineLegend: 'Base',
    scenarioLegend: 'Scénario',
    baselineRevRow: 'Revenu de base',
    scenarioRevRow: 'Revenu scénario',
    scenarioProfitRow: 'Bénéfice scénario',

    // Month abbreviations
    months: ['Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep'],
    forecastMonths: ['Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar'],
    quarterLabels: ['Oct–Déc', 'Jan–Mar', 'Avr–Juin', 'Juil–Sep'],

    // Suggested Questions
    suggestedQuestions: [
      'Quel était le chiffre d’affaires au dernier trimestre ?',
      'Comment le bénéfice a-t-il évolué par rapport au trimestre précédent ?',
      'Quelle est la marge bénéficiaire actuelle ?',
      'Quel mois a enregistré le chiffre d’affaires le plus élevé ?',
      'Que prévoient les modèles pour le mois prochain ?',
    ],
  },

  hi: {
    // Brand & App
    appName: 'NEXORA',
    appSubtitle: 'एआई कंपनी इंटेलिजेंस प्लेटफॉर्म',
    currencyUnit: '₹ करोड़ · पिछले 12 महीने (सिंथेटिक डेटा)',
    syntheticSegmentSplit: 'सिंथेटिक खंड विभाजन',
    syntheticCostSplit: 'सिंथेटिक लागत विभाजन',
    lastQuarter: 'पिछली तिमाही',

    // Nav
    dash: 'डैशबोर्ड',
    kpi: 'कंपनी और केपीआई',
    ana: 'एनालिटिक्स',
    fc: 'पूर्वानुमान',
    ai: 'एआई विश्लेषक',
    wi: 'व्हाट-इफ सिमुलेशन',
    notAvailableRole: 'आपकी भूमिका के लिए उपलब्ध नहीं',
    signOut: 'साइन आउट',
    role: 'भूमिका',

    // Status
    backendOnline: 'FastAPI बैकएंड ऑनलाइन',
    standaloneMode: 'स्टैंडअलोन / मॉक मोड',
    apiConnected: 'एपीआई कनेक्टेड',
    localEngine: 'लोकल इंजन सक्रिय',

    // Login
    signIn: 'साइन इन करें',
    signingIn: 'साइन इन हो रहा है...',
    demoRolesPrompt: 'डेमो भूमिकाएं (पासवर्ड demo123):',
    invalidCredentials: 'अमान्य क्रेडेंशियल',
    emailPlaceholder: 'ईमेल',
    passwordPlaceholder: 'पासवर्ड',

    // Dashboard
    revenueQ: 'राजस्व (तिमाही)',
    expensesQ: 'खर्चे (तिमाही)',
    profitQ: 'लाभ (तिमाही)',
    profitMargin: 'लाभ मार्जिन',
    vsPrevQuarter: 'पिछली तिमाही की तुलना में',
    revVsExp: 'राजस्व बनाम खर्चे',
    monthlyProfit: 'मासिक लाभ',
    revMixSegment: 'खंड अनुसार राजस्व मिश्रण',
    expenseBreakdown: 'खर्चों का विवरण',
    profitMarginTrend: 'लाभ मार्जिन रुझान (%)',
    quarterlyRevVsExp: 'तिमाही राजस्व बनाम खर्चे',
    revenueLegend: 'राजस्व',
    expensesLegend: 'खर्चे',
    profitLegend: 'लाभ',

    // Company & KPIs
    companyProfile: 'कंपनी प्रोफाइल',
    companyName: 'नाम',
    sector: 'क्षेत्र',
    hq: 'मुख्यालय',
    founded: 'स्थापना वर्ष',
    employees: 'कर्मचारी',
    kpiFinancials: 'केपीआई / वित्तीय आंकड़े',
    adminEditNote: '(एडमिन: राजस्व और खर्चे संपादित करें)',
    readOnlyNote: '({role} के लिए केवल पढ़ने योग्य)',
    monthCol: 'माह',
    revenueCol: 'राजस्व',
    expensesCol: 'खर्चे',
    profitCol: 'लाभ',
    marginCol: 'मार्जिन',

    // Analytics
    growth12Mo: '12-माह वृद्धि (YoY)',
    qoqRevenue: 'तिमाही राजस्व वृद्धि (QoQ)',
    qoqProfit: 'तिमाही लाभ वृद्धि (QoQ)',
    bestMonth: 'सर्वश्रेष्ठ माह',
    revProfitTrend: 'राजस्व और लाभ रुझान',
    periodComparison: 'अवधि तुलना (पिछली तिमाही बनाम पूर्व तिमाही)',
    metricCol: 'मापदंड',
    prevQCol: 'पूर्व तिमाही',
    lastQCol: 'अंतिम तिमाही',
    changeCol: 'बदलाव',
    momRevenueGrowth: 'माह-दर-माह राजस्व वृद्धि',
    positiveGrowth: 'सकारात्मक',
    negativeGrowth: 'नकारात्मक (परिमाण)',

    // Forecast
    model: 'मॉडल',
    linearTrend: 'रैखिक रुझान',
    nextMonthRevenue: 'अगले महीने का राजस्व',
    projected6Mo: '6-माह अनुमानित कुल',
    backtestMape: 'बैकटेस्ट MAPE',
    revenueForecast6Mo: 'राजस्व पूर्वानुमान – अगले 6 महीने',
    actualLegend: 'वास्तविक',
    forecastLegend: 'पूर्वानुमान',
    forecastFootnote: 'एकल प्राथमिक मापदंड (राजस्व)। मूल्यांकन: पहले 9 महीनों पर मॉडल फिट, अंतिम 3 पर परीक्षण (MAPE)।',

    // AI Analyst
    aiTitle: 'एआई बिजनेस एनालिस्ट से पूछें',
    aiSubtitle: 'उत्तर केवल {name} के स्वीकृत केपीआई डेटा पर आधारित हैं।',
    aiEmptyPrompt: 'नीचे दिए गए प्रश्न चुनें या अपना लिखें।',
    askInputPlaceholder: 'राजस्व, लाभ, मार्जिन, पूर्वानुमान के बारे में पूछें…',
    askButton: 'पूछें',
    thinking: 'सोच रहा है...',
    sourcePrefix: 'स्रोत: ',
    kpiTableSource: 'केपीआई तालिका, {name}',
    forecastModelSource: 'राजस्व पूर्वानुमान मॉडल',

    // What-If
    assumptionGrowth: 'धारणा: मासिक राजस्व वृद्धि',
    perMonth: '{val}% / माह',
    resetBaseline: 'बेसलाइन पर रीसेट करें',
    baselineNote: 'बेसलाइन = ऐतिहासिक औसत वृद्धि ({val}%/माह)। व्यय अनुपात पिछली तिमाही के स्तर पर स्थिर।',
    rev6Mo: '6-माह राजस्व',
    prof6Mo: '6-माह लाभ',
    baselinePrefix: 'बेसलाइन {val}',
    vsBaseline: 'बेसलाइन की तुलना में',
    baselineVsScenario: 'बेसलाइन बनाम परिदृश्य – राजस्व',
    baselineLegend: 'बेसलाइन',
    scenarioLegend: 'परिदृश्य',
    baselineRevRow: 'बेसलाइन राजस्व',
    scenarioRevRow: 'परिदृश्य राजस्व',
    scenarioProfitRow: 'परिदृश्य लाभ',

    // Month abbreviations
    months: ['अक्तू', 'नवं', 'दिसं', 'जन', 'फर', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सितं'],
    forecastMonths: ['अक्तू', 'नवं', 'दिसं', 'जन', 'फर', 'मार्च'],
    quarterLabels: ['अक्तू–दिसं', 'जन–मार्च', 'अप्रै–जून', 'जुला–सितं'],

    // Suggested Questions
    suggestedQuestions: [
      'पिछली तिमाही में राजस्व कितना था?',
      'पूर्व तिमाही की तुलना में लाभ कैसे बदला?',
      'वर्तमान लाभ मार्जिन क्या है?',
      'किस महीने में सबसे अधिक राजस्व प्राप्त हुआ?',
      'अगले महीने के लिए पूर्वानुमान क्या कहता है?',
    ],
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function getTranslation(lang: SupportedLanguage, key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  let text = (dict as Record<string, unknown>)[key];

  if (typeof text !== 'string') {
    text = (TRANSLATIONS.en as Record<string, unknown>)[key] || '';
  }

  if (typeof text === 'string' && params) {
    let result = text;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return result;
  }

  return typeof text === 'string' ? text : '';
}
