import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const toMyanmarDigits = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const myanmarDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return str.replace(/[0-9]/g, (match) => myanmarDigits[parseInt(match, 10)]);
};

export const toEnglishDigits = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const mmMap = {
    '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
    '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9'
  };
  return str.replace(/[၀-၉]/g, (match) => mmMap[match]);
};

export const translations = {
  mm: {
    // Header & Navbar
    platformName: "ရွှေဥဒေါင်း",
    platformSub: "စင်ကာပူ ၄လုံးထီ",
    peacockBadge: "ရွှေဥဒေါင်း တရားဝင်",
    officialAgent: "စင်ကာပူ ၄လုံးထီ တရားဝင် အေးဂျင့်",
    balance: "လက်ကျန်ငွေ",
    noti: "အသိပေးချက်များ",
    notiNew: "အသစ်",
    markAllRead: "အားလုံး ဖတ်ပြီးအဖြစ် သတ်မှတ်မည်",
    noNotif: "အသိပေးချက် မရှိသေးပါ",
    langToggle: "မြန်မာ",
    logout: "ထွက်ရန်",

    // Navigation Tabs
    tabBetting: "၄လုံးထီ ထိုးရန်",
    tabResults: "ထီပေါက်စဉ်",
    tabSlips: "ပြေစာများ",
    tabProfile: "မိမိအကောင့်",
    tabAdmin: "ငွေစာရင်းချုပ်",

    // Banners
    drawCutoffTitle: "ထိုးကြေးပိတ်ချိန်: ညနေ ၄:၃၀ နာရီ (ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ)",
    drawCutoffSub: "ညနေ ၄:၃၀ နာရီ နောက်ပိုင်း ထိုးကြေးများအားလုံး ပိတ်ပါမည်။",
    weeklyBonusTitle: "၁၀% အပတ်စဉ် ကစားသူအပိုဆုကြေး",
    weeklyBonusSub: "တစ်ပတ်အတွင်း ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ (Wed, Sat, Sun) ၃ ရက်စလုံး တစ်ရက်မှမပျက်ဘဲ တစ်ရက်လျှင် အနည်းဆုံး ၁၀,၀၀၀ ကျပ် ထိုးထားသော ပုံမှန်ကစားသူများအတွက် အပတ်စဉ် အင်္ဂါနေ့ နံနက် ၁၁:၀၀ နာရီတွင် ၁၀% ပြန်အမ်းငွေ ရရှိပါမည်။",
    minMaxTitle: "၄လုံးထီ ထိုးကြေးသတ်မှတ်ချက်",
    minMaxLimits: "အနည်းဆုံး: ၅၀ ကျပ် • အများဆုံး: ၁၀,၀၀၀ ကျပ်",
    luckyPick: "ကံစမ်းဂဏန်း ရယူမည်",
    singaporePoolsBrand: "စင်ကာပူ ၄လုံးထီ",
    officialDrawsSchedule: "စင်ကာပူ ၄လုံးထီ • တရားဝင် ထီဖွင့်ရက်များ: ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ (ညနေ ၆:၀၀ နာရီ)",

    // Draw selection
    selectDrawDays: "ထိုးမည့်နေ့ ရွေးချယ်ပါ",
    selectDrawNotice: "* လက်ရှိတစ်ပတ်စာ (ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ) အတွက်သာ တင်နိုင်ပါသည်။ ညနေ ၄:၃၀ နာရီ ကျော်လွန်သွားသော နေ့များသည် ရွေးချယ်မှုစာရင်းမှ အလိုအလျောက် ပျောက်ကွယ်သွားပါမည်။",
    allWeek: "တစ်ပတ်စာ အကုန်ထိုးမည်",
    drawsCount: "ရွေးချယ်ထားသော နေ့အရေအတွက်",
    dayWed: "ဗုဒ္ဓဟူးနေ့",
    daySat: "စနေနေ့",
    daySun: "တနင်္ဂနွေနေ့",
    todayBadge: "ယနေ့",
    daysUnit: "ရက်",
    multiDraw: "ရက်စုံထိုးခြင်း",
    singleDraw: "တစ်ရက်တည်းထိုးခြင်း",

    // Bet Types
    betType: "ထိုးကြေး အမျိုးအစား",
    ordinary: "တိုက်ရိုက်",
    ordinarySub: "၁ တွဲ",
    box: "R",
    boxSub: "ပတ်လည် အားလုံး",
    roll: "ဂဏန်းအစုံ (Series - S)",
    rollSub: "၁၀ တွဲ",

    // Number Entry
    numberEntry: "၄လုံး ဂဏန်း ရိုက်ထည့်ပါ",
    useSForSeries: "(ဂဏန်းအစုံအတွက် 'S' သုံးပါ)",
    series1st: "ရှေ့ဂဏန်းအစုံ (S___)",
    seriesLast: "နောက်ဂဏန်းအစုံ (___S)",
    stakePerNumber: "ထိုးကြေးပမာဏ",
    stakePerCombo: "တစ်တွဲလျှင်",
    minMaxHint: "အနည်းဆုံး ၅၀ ကျပ် မှ ၁၀,၀၀၀ ကျပ် အထိ",
    payoutInfo: "ပထမဆု: ၂,၀၀၀ ဆ • ဒုတိယဆု: ၁,၀၀၀ ဆ • တတိယဆု: ၅၀၀ ဆ",
    firstPrizeRatio: "၂,၀၀၀ ဆ",
    secondPrizeRatio: "၁,၀၀၀ ဆ",
    thirdPrizeRatio: "၅၀၀ ဆ",
    starterPrizeRatio: "၁၀၀ ဆ",
    consolationPrizeRatio: "၃၀ ဆ",
    totalStake: "စုစုပေါင်း ထိုးကြေး",
    addToSlip: "လောင်းကြေးစာရင်း သွင်းမည်",
    generatedCombos: "ထွက်ရှိလာသော ဂဏန်းအတွဲများ",
    ticketsUnit: "စောင်",

    // Cart / Live Slip
    liveSlipTitle: "လက်ရှိ လောင်းကြေးပြေစာ",
    numbersCount: "ခု",
    combos: "တွဲ",
    drawsSelected: "ရက်စုံ",
    clearSlip: "အားလုံး ဖျက်မည်",
    placeBet: "လောင်းကြေး အတည်ပြုတင်မည်",
    confirming: "အတည်ပြုနေပါသည်...",
    emptySlip: "လောင်းကြေးစာရင်း မရှိသေးပါ",
    emptySlipSub: "၄လုံး ဂဏန်း ရွေးချယ်ပြီး 'လောင်းကြေးစာရင်း သွင်းမည်' ကို နှိပ်ပါ",
    targetDraws: "ထိုးမည့်နေ့များ",
    totalCombinations: "စုစုပေါင်း အတွဲအရေအတွက်",
    singleDrawStake: "တစ်ရက်စာ ထိုးကြေး",
    grandTotalStake: "စုစုပေါင်း ကျသင့်ငွေ",
    yourBalance: "မိမိ လက်ကျန်ငွေ",
    insufficientBalance: "လက်ကျန်ငွေ မလုံလောက်ပါ • ငွေဖြည့်ပါ",
    betSuccessTitle: "လောင်းကြေး အောင်မြင်စွာ တင်ပြီးပါပြီ!",
    slipCodeLabel: "ပြေစာအမှတ်",
    commissionCredited: "၃၀% အေးဂျင့် ကော်မရှင် ထည့်သွင်းပြီး",
    dismiss: "ပိတ်မည်",
    loginToPlaceBet: "လောင်းကြေးတင်ရန် အကောင့်ဝင်ပါ",
    selectAtLeastOneDraw: "အနည်းဆုံး ထိုးမည့်နေ့ ၁ ရက် ရွေးချယ်ပေးပါ",
    betPlacementFailed: "လောင်းကြေးတင်ခြင်း မအောင်မြင်ပါ",

    // Results
    resultsTitle: "စင်ကာပူ ၄လုံးထီ တရားဝင် ထီပေါက်စဉ်နှင့် ဆုကြေးများ",
    resultsSub: "ဗုဒ္ဓဟူး၊ စနေ၊ တနင်္ဂနွေ • ညနေ ၆:၀၀ နာရီတွင် အလိုအလျောက် ဆုကြေးရှင်းပေးပါသည်",
    drawDateLabel: "ထီဖွင့်သည့်နေ့",
    drawStatusLabel: "အခြေအနေ",
    firstPrize: "ပထမဆု",
    secondPrize: "ဒုတိယဆု",
    thirdPrize: "တတိယဆု",
    firstPrizeDesc: "၁၀၀ ကျပ် ထိုးပါက ၂၀၀,၀၀၀ ကျပ် ရရှိမည်",
    secondPrizeDesc: "၁၀၀ ကျပ် ထိုးပါက ၁၀၀,၀၀၀ ကျပ် ရရှိမည်",
    thirdPrizeDesc: "၁၀၀ ကျပ် ထိုးပါက ၅၀,၀၀၀ ကျပ် ရရှိမည်",
    boxRollBonusBanner: "ဆုကြီး ၃ ဆု၏ ပတ်လည်ဆု: ပထမ၊ ဒုတိယ၊ တတိယဆုတို့၏ ပတ်လည်ဂဏန်း တိုက်ဆိုင်ပါက ၁၀ ဆ ပေးပါသည်",
    boxMultiplierBadge: "၁၀ ဆ ဆုကြေး",
    starterPrizes: "အထူးဆု (၁၀ ဆု)",
    consolationPrizes: "နှစ်သိမ့်ဆု (၁၀ ဆု)",
    firstPrizePayout: "၂,၀၀၀ ဆ ဆုကြေး",
    secondPrizePayout: "၁,၀၀၀ ဆ ဆုကြေး",
    thirdPrizePayout: "၅၀၀ ဆ ဆုကြေး",
    starterPrizePayout: "၁၀၀ ဆ ဆုကြေး",
    consolationPrizePayout: "၃၀ ဆ ဆုကြေး",
    drawCompleted: "ဖွင့်ပြီး",
    drawPending: "စောင့်ဆိုင်းဆဲ",
    syncSgPoolsBtn: "Singapore Pools တိုက်စစ်မည်",
    syncingLabel: "တိုက်စစ်နေပါသည်...",
    sgPoolsSourceLabel: "တရားဝင် ရင်းမြစ်: singaporepools.com.sg • အလိုအလျောက် ပေါက်/မပေါက် စစ်ဆေးပေးသည်",
    winnersSectionTitle: "တရားဝင် ပေါက်ဆုရှင်များ စာရင်း",
    winnersSubtitle: "ယခုပွဲစဉ်တွင် ကံထူးဆု ရရှိခဲ့ကြသူများနှင့် ဆုကြေးငွေများ",
    totalWinnersLabel: "စုစုပေါင်း ကံထူးရှင်",
    totalPaidOutLabel: "စုစုပေါင်း ပေးချေပြီး ဆုကြေး",
    nilWinner: "ဆုရှင်မရှိပါ (NIL)",
    nilWinnerSub: "ဤဆုအတွက် ထီပေါက်သူ မရှိသေးပါ",
    winnerTicketNumber: "ပေါက်ဂဏန်း",
    winnerWonAmount: "ရရှိဆုငွေ",
    recentWinnersTicker: "ပေါက်ဆုရရှိသူများ:",
    realWinnerBadge: "တရားဝင် ကစားသူ ✓",

    // Slips
    slipsTitle: "ထိုးကြေးမှတ်တမ်းနှင့် ပြေစာများ",
    slipsSubtitle: "တင်ထားသော လောင်းကြေးများ၊ ထီဖွင့်လှစ်မှုနှင့် ပေါက်ဆုမှတ်တမ်းများ",
    all: "အားလုံး",
    pending: "စောင့်ဆိုင်းဆဲ",
    won: "ပေါက်ဆုရရှိ",
    lost: "မပေါက်ပါ",
    noSlips: "ထိုးကြေးပြေစာ မရှိသေးပါ",
    noSlipsSub: "၄လုံး ဂဏန်းများ ထိုးပြီးပါက ဤနေရာတွင် စစ်ဆေးနိုင်ပါသည်",
    betNow: "ထိုးမည်",
    loadingSlips: "ပြေစာများ ခေါ်ယူနေပါသည်...",
    stakeLabel: "ထိုးကြေး",
    wonLabel: "ရရှိဆုငွေ",
    breakdownLabel: "ထိုးထားသော ဂဏန်းအသေးစိတ်",
    purchasedAmount: "ဝယ်ထားသည့်အမောင့်",
    drawDateShort: "ထီဖွင့်ရက်",
    betPlacedTime: "ထိုးချိန်",
    viewCombos: "ဂဏန်းအတွဲများ ကြည့်မည်",
    hideCombos: "ပိတ်မည်",

    // Wallet / Deposit & Withdraw Modal
    walletTitle: "ငွေသွင်း / ငွေထုတ် ပြုလုပ်ရန်",
    walletSubtitle: "KPay၊ WavePay၊ AYA Pay ဖြင့် လျင်မြန်စွာ ငွေသွင်း/ငွေထုတ် ပြုလုပ်နိုင်ပါသည်",
    cashInTab: "ငွေသွင်းရန် (ငွေဖြည့်)",
    cashOutTab: "ငွေထုတ်ရန်",
    depositTitle: "ငွေသွင်းရန်",
    withdrawTitle: "ငွေထုတ်ရန်",
    currentBalance: "လက်ရှိ လက်ကျန်ငွေ",
    selectGateway: "ငွေပေးချေမှု နည်းလမ်း ရွေးချယ်ပါ",
    transferAccount: "ငွေလွှဲလက်ခံမည့် အကောင့်",
    accountName: "အကောင့်အမည်",
    accountNumber: "အကောင့်နံပါတ်",
    copyAccount: "အကောင့်နံပါတ် ကူးယူမည်",
    copied: "ကူးယူပြီးပါပြီ!",
    depositNotice: "ငွေလွှဲပြီးပါက လွှဲငွေအမှတ် (နောက်ဆုံး ၆ လုံး) နှင့် ပြေစာပုံ တင်ပေးပါ (၁၅ မိနစ်အတွင်း အလိုအလျောက် ဖြည့်သွင်းပေးပါသည်)",
    withdrawNotice: "ငွေထုတ်ယူခြင်းကို နေ့စဉ် နံနက် ၀၈:၀၀ နာရီ မှ ည ၀၈:၀၀ နာရီအတွင်း မိနစ်ပိုင်းအတွင်း လွှဲပြောင်းပေးပါသည်",
    operatingHours: "ဝန်ဆောင်မှုချိန်: နံနက် ၀၈:၀၀ မှ ည ၀၈:၀၀ နာရီ",
    autoVerifyBadge: "၁၅ မိနစ်အတွင်း အလိုအလျောက် အတည်ပြု",
    processedInMinsBadge: "မိနစ်ပိုင်းအတွင်း ရရှိမည်",
    autoApprovedTitle: "ချက်ချင်း အလိုအလျောက် ငွေဖြည့်သွင်းပြီးပါပြီ!",
    officialReceiverTitle: "ငွေလွှဲလက်ခံမည့် တရားဝင် အကောင့်",
    agentVerifiedBadge: "တရားဝင် အတည်ပြုပြီး ✓",
    copyBtn: "ကူးယူမည်",
    copiedBtn: "ကူးယူပြီးပါပြီ!",
    minWithdrawLimit: "အနည်းဆုံး ငွေထုတ်ပမာဏ: ၁,၀၀၀ ကျပ်",
    withdrawAmount: "ငွေထုတ်မည့် ပမာဏ (ကျပ်)",
    transferAmountLabel: "လွှဲငွေပမာဏ (ကျပ်)",
    txIdLabel: "လွှဲငွေအမှတ် (ရည်ညွှန်းနံပါတ်) *",
    txIdPlaceholder: "ဥပမာ: ၂၀၂၆၁၀၁၃၈၉၄၁၂၃ (နောက်ဆုံး ၆ လုံးလည်းရပါသည်)",
    transferAmountPlaceholder: "ဥပမာ: ၂၀,၀၀၀",
    withdrawAmountPlaceholder: "ဥပမာ: ၁၀,၀၀၀",
    uploadProof: "ငွေလွှဲပြေစာ ပုံတင်ရန် (ရွေးချယ်နိုင်သည်)",
    chooseFile: "ပြေစာပုံ ရွေးချယ်ပါ",
    previewFile: "ပုံကြည့်မည်",
    receiverName: "လက်ခံမည့်သူ အမည် *",
    receiverPhone: "လက်ခံမည့် ဖုန်းနံပါတ် / အကောင့် *",
    submitCashIn: "ငွေသွင်း အတည်ပြုမည်",
    submitCashOut: "ငွေထုတ် တောင်းဆိုမည်",
    submittingBtn: "အတည်ပြုနေပါသည်...",
    maxAll: "အကုန်ထုတ်မည်",
    backBtn: "ပြန်ထွက်ရန်",
    backToMain: "ပင်မစာမျက်နှာသို့ ပြန်သွားမည်",
    cancelBtn: "မလုပ်တော့ပါ",
    minWithdrawError: "အနည်းဆုံး ငွေထုတ်ပမာဏသည် ၁,၀၀၀ ကျပ် ဖြစ်ရပါမည်။",
    insufficientBalanceError: "လက်ကျန်ငွေ မလုံလောက်ပါ။",

    // Profile
    profileTitle: "မိမိအကောင့် အချက်အလက်",
    accountInfo: "အကောင့် အချက်အလက်များ",
    username: "အကောင့်အမည်",
    phone: "ဖုန်းနံပါတ်",
    agentBound: "ချိတ်ဆက်ထားသော အေးဂျင့်",
    changePassword: "စကားဝှက် ပြောင်းလဲရန်",
    oldPassword: "လက်ရှိ စကားဝှက်",
    newPassword: "စကားဝှက်အသစ်",
    confirmPassword: "စကားဝှက်အသစ် အတည်ပြုပါ",
    updatePasswordBtn: "စကားဝှက် အသစ်သတ်မှတ်မည်",
    cashHistoryTitle: "ငွေသွင်း / ငွေထုတ် မှတ်တမ်းများ",
    noTransactions: "ငွေသွင်း/ငွေထုတ် မှတ်တမ်း မရှိသေးပါ",
    loadingTransactions: "ငွေသွင်း/ငွေထုတ် မှတ်တမ်းများ ခေါ်ယူနေပါသည်...",
    contactUsTitle: "ဆက်သွယ်ရန်နှင့် အကူအညီ",
    contactBot: "တရားဝင် တယ်လီဂရမ် ဘော့တ်",
    contactChannel: "တရားဝင် တယ်လီဂရမ် ချန်နယ်",
    contactPhone: "ဖောက်သည် ဝန်ဆောင်မှု ဖုန်းလိုင်း",
    signOutBtn: "အကောင့်မှ ထွက်မည်",
    signOutConfirm: "အကောင့်မှ ထွက်ရန် သေချာပါသလား?",
    currencySymbol: "ကျပ်",
    openTelegram: "တယ်လီဂရမ် ဖွင့်မည် →",
    joinChannel: "ချန်နယ်သို့ ဝင်မည် →",
    approved: "အတည်ပြုပြီး",
    underReview: "စစ်ဆေးဆဲ",
    rejected: "ငြင်းပယ်",
    completed: "ပြီးစီး",
    txIdLabelOnly: "လွှဲငွေအမှတ်",
    cashInAction: "ငွေသွင်းခြင်း",
    cashOutAction: "ငွေထုတ်ခြင်း",
    winPayoutAction: "ဆုကြေးငွေ ရရှိခြင်း",
    filterAll: "အားလုံး",
    filterDeposit: "ငွေသွင်း",
    filterWithdraw: "ငွေထုတ်",
    filterPrize: "ဆုကြေးငွေ",

    // Auth Modal
    loginTitle: "အကောင့်ဝင်ရန်",
    registerTitle: "အကောင့်သစ်ဖွင့်ရန် (Sign Up)",
    forgotPasswordTitle: "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
    loginSubtitle: "ဖုန်းနံပါတ်ဖြင့် ဝင်ရောက်ပါ",
    forgotPasswordSubtitle: "တယ်လီဂရမ် အတည်ပြုကုဒ်ဖြင့် စကားဝှက် အသစ်သတ်မှတ်ပါ",
    phoneLabel: "ဖုန်းနံပါတ်",
    passwordLabel: "စကားဝှက်",
    forgotPasswordLink: "စကားဝှက် မေ့နေပါသလား?",
    loginBtn: "အကောင့်ဝင်မည်",
    agentCodeLabel: "အေးဂျင့် / ရည်ညွှန်းကုဒ် *",
    verifiedBadge: "အတည်ပြုပြီး",
    usernameLabel: "အသုံးပြုသူအမည် *",
    fullNameLabel: "အမည်ရင်း",
    telegramVerificationTitle: "တယ်လီဂရမ် အတည်ပြုခြင်း *",
    sendOtpBtn: "အတည်ပြုကုဒ် ရယူမည်",
    resendOtpBtn: "ကုဒ် ပြန်ပို့မည်",
    sendingOtp: "ကုဒ် ပို့နေပါသည်...",
    enterOtpPlaceholder: "၆ လုံးပါ ကုဒ် ရိုက်ထည့်ပါ",
    verifyBtn: "အတည်ပြုမည်",
    registerBtn: "အကောင့်သစ် ဖွင့်မည်",
    userIdOrPhoneLabel: "မှတ်ပုံတင်ထားသော ဖုန်းနံပါတ် သို့မဟုတ် အကောင့်အမည်",
    userIdOrPhonePlaceholder: "ဥပမာ: ၀၉၈၈၈၈၈၈၈၈၈ သို့မဟုတ် အကောင့်အမည်",
    newPasswordLabel: "စကားဝှက်အသစ် *",
    resetPasswordBtn: "စကားဝှက် အသစ်သတ်မှတ်မည်",
    backToLoginBtn: "အကောင့်ဝင်ရန်သို့ ပြန်သွားမည်",
    goToSignUp: "Sign up: (အကောင့်သစ်ဖွင့်ရန်)",
    goToLogin: "အကောင့်ရှိပြီးသားဖြစ်ပါက ဝင်ရောက်ရန် (Log In)"
  },
  en: {
    // Header & Navbar
    platformName: "SG4D",
    platformSub: "Myanmar",
    peacockBadge: "Golden Peacock",
    officialAgent: "Official Singapore 4D Agent",
    balance: "Balance",
    noti: "Notifications",
    notiNew: "New",
    markAllRead: "Mark all read",
    noNotif: "No notifications",
    langToggle: "English",
    logout: "Log Out",

    // Navigation Tabs
    tabBetting: "4D Bet",
    tabResults: "Results",
    tabSlips: "Slips",
    tabProfile: "Profile",
    tabAdmin: "Financial Ledger",

    // Banners
    drawCutoffTitle: "Draw Cut-off: 4:30 PM MMT (Wed, Sat, Sun)",
    drawCutoffSub: "All bets strictly close at 4:30 PM MMT.",
    weeklyBonusTitle: "10% Weekly Player Bonus",
    weeklyBonusSub: "Bet at least 10,000 MMK on every draw day (Wed, Sat, Sun) without missing any day! Credited every Tuesday at 11:00 AM MMT for regular players.",
    minMaxTitle: "4D Betting Entry",
    minMaxLimits: "Min: 50 MMK • Max: 10,000 MMK",
    luckyPick: "Lucky Pick",
    singaporePoolsBrand: "Singapore Pools 4D",
    officialDrawsSchedule: "Singapore Pools 4D • Official Draws: Wed, Sat, Sun (6:00 PM MMT)",

    // Draw selection
    selectDrawDays: "SELECT DRAW DAYS",
    selectDrawNotice: "* Current week bets only (Wed, Sat, Sun). Draws past 4:30 PM MMT will automatically close.",
    allWeek: "Bet All Week (3 Draws)",
    drawsCount: "Selected Draw Days",
    dayWed: "Wednesday",
    daySat: "Saturday",
    daySun: "Sunday",
    todayBadge: "Today",
    daysUnit: "Days",
    multiDraw: "Multi-Draw",
    singleDraw: "Single Draw",

    // Bet Types
    betType: "Bet Type",
    ordinary: "Ordinary",
    ordinarySub: "1 Combo",
    box: "R",
    boxSub: "All Permutations",
    roll: "Series (Roll - S)",
    rollSub: "10 Combos",

    // Number Entry
    numberEntry: "4-Digit Number",
    useSForSeries: "(Use 'S' for Series)",
    series1st: "Series 1st (S___)",
    seriesLast: "Series Last (___S)",
    stakePerNumber: "Stake Amount",
    stakePerCombo: "Per Combo",
    minMaxHint: "Min 50 MMK to 10,000 MMK",
    payoutInfo: "1st: 2,000x • 2nd: 1,000x • 3rd: 500x",
    firstPrizeRatio: "2,000x",
    secondPrizeRatio: "1,000x",
    thirdPrizeRatio: "500x",
    starterPrizeRatio: "100x",
    consolationPrizeRatio: "30x",
    totalStake: "Total Stake",
    addToSlip: "ADD TO BET SLIP",
    generatedCombos: "Generated Combinations",
    ticketsUnit: "tickets",

    // Cart / Live Slip
    liveSlipTitle: "Live Bet Slip Queue",
    numbersCount: "Numbers",
    combos: "combos",
    drawsSelected: "Draws",
    clearSlip: "Clear All",
    placeBet: "PLACE 4D BET",
    confirming: "Confirming...",
    emptySlip: "Your bet slip is empty",
    emptySlipSub: "Select 4D numbers and click 'ADD TO BET SLIP'",
    targetDraws: "Target Draw(s)",
    totalCombinations: "Total Combinations",
    singleDrawStake: "Single Draw Stake",
    grandTotalStake: "Grand Total Stake",
    yourBalance: "Your Current Balance",
    insufficientBalance: "INSUFFICIENT BALANCE • TOP UP NOW",
    betSuccessTitle: "Bet Placed Successfully!",
    slipCodeLabel: "Slip Code",
    commissionCredited: "30% Agent Commission Credited",
    dismiss: "Dismiss",
    loginToPlaceBet: "Login to Place Bet",
    selectAtLeastOneDraw: "Please select at least one draw day.",
    betPlacementFailed: "Failed to place bet.",

    // Results
    resultsTitle: "Singapore 4D Official Results & Payouts",
    resultsSub: "Draws Wed, Sat, Sun • Automated Payout Settles at 06:00 PM MMT",
    drawDateLabel: "Draw Date",
    drawStatusLabel: "Status",
    firstPrize: "1st Prize",
    secondPrize: "2nd Prize",
    thirdPrize: "3rd Prize",
    firstPrizeDesc: "100 MMK -> 200,000 MMK",
    secondPrizeDesc: "100 MMK -> 100,000 MMK",
    thirdPrizeDesc: "100 MMK -> 50,000 MMK",
    boxRollBonusBanner: "Permutation / Box Prize: Pays 10x for permutation match with Top 3 prizes!",
    boxMultiplierBadge: "10x Multiplier",
    starterPrizes: "Starter Prizes (10 Prizes)",
    consolationPrizes: "Consolation Prizes (10 Prizes)",
    firstPrizePayout: "2,000x Payout",
    secondPrizePayout: "1,000x Payout",
    thirdPrizePayout: "500x Payout",
    starterPrizePayout: "100x Payout",
    consolationPrizePayout: "30x Payout",
    drawCompleted: "COMPLETED",
    drawPending: "PENDING",
    syncSgPoolsBtn: "Sync Singapore Pools",
    syncingLabel: "Syncing...",
    sgPoolsSourceLabel: "Official Source: singaporepools.com.sg • Auto Win/Loss Settlement",
    winnersSectionTitle: "Official Prize Winners",
    winnersSubtitle: "Players who won prizes in this official draw",
    totalWinnersLabel: "Total Winners",
    totalPaidOutLabel: "Total Paid Out",
    nilWinner: "No Winner (NIL)",
    nilWinnerSub: "No player matched this prize category in this draw",
    winnerTicketNumber: "Winning No.",
    winnerWonAmount: "Won Amount",
    recentWinnersTicker: "Recent Winners:",
    realWinnerBadge: "Verified Player ✓",

    // Slips
    slipsTitle: "Bet History & Slips",
    slipsSubtitle: "Track active bets, draw settlements, and prize winnings",
    all: "ALL",
    pending: "PENDING",
    won: "WON",
    lost: "LOST",
    noSlips: "No bet slips found",
    noSlipsSub: "Place bets on 4D numbers to view them here",
    betNow: "Place 4D Bet",
    loadingSlips: "Loading bet slips...",
    stakeLabel: "Stake",
    wonLabel: "Total Won",
    breakdownLabel: "Bet Items Breakdown",
    purchasedAmount: "Purchased Amount",
    drawDateShort: "Draw Date",
    betPlacedTime: "Placed Time",
    viewCombos: "View Combinations",
    hideCombos: "Hide Combinations",

    // Wallet / Deposit & Withdraw Modal
    walletTitle: "Wallet Management",
    walletSubtitle: "Fast Deposits & Withdrawals via KPay, WavePay, AYA Pay",
    cashInTab: "Top Up (Cash In)",
    cashOutTab: "Withdraw (Cash Out)",
    depositTitle: "Top Up (Deposit)",
    withdrawTitle: "Withdraw (Cash Out)",
    currentBalance: "Current Balance",
    selectGateway: "Select Payment Gateway",
    transferAccount: "Deposit Account",
    accountName: "Account Name",
    accountNumber: "Account Number",
    copyAccount: "Copy Account Number",
    copied: "Copied!",
    depositNotice: "After transferring, enter the last 6 digits of TxID and screenshot. Auto-approved within 15 mins.",
    withdrawNotice: "Withdrawals are processed daily between 08:00 AM - 08:00 PM MMT within minutes.",
    operatingHours: "Operating Hours: 08:00 AM – 08:00 PM (MMT)",
    autoVerifyBadge: "AUTO-VERIFY 15 MIN",
    processedInMinsBadge: "PROCESSED IN MINUTES",
    autoApprovedTitle: "INSTANT AUTO-APPROVAL GRANTED!",
    officialReceiverTitle: "Official Receiver Account",
    agentVerifiedBadge: "Agent Verified ✓",
    copyBtn: "Copy",
    copiedBtn: "Copied!",
    minWithdrawLimit: "Minimum Withdrawal: 1,000 MMK",
    withdrawAmount: "Withdrawal Amount (MMK)",
    transferAmountLabel: "Transfer Amount (MMK)",
    txIdLabel: "Transaction ID (TxID) *",
    txIdPlaceholder: "e.g. 20261013894123 (last 6 digits accepted)",
    transferAmountPlaceholder: "e.g. 20,000",
    withdrawAmountPlaceholder: "e.g. 10,000",
    uploadProof: "Upload Slip Screenshot (Optional)",
    chooseFile: "Choose slip screenshot",
    previewFile: "Preview",
    receiverName: "Account Holder Name *",
    receiverPhone: "Receiver Phone / Account *",
    submitCashIn: "CONFIRM TOP UP",
    submitCashOut: "REQUEST WITHDRAWAL",
    submittingBtn: "Submitting...",
    maxAll: "Max All",
    backBtn: "Back",
    backToMain: "Back to Main",
    cancelBtn: "Cancel",
    minWithdrawError: "Minimum withdrawal is 1,000 MMK.",
    insufficientBalanceError: "Insufficient wallet balance.",

    // Profile
    profileTitle: "My Profile",
    accountInfo: "Account Information",
    username: "Username",
    phone: "Phone Number",
    agentBound: "Linked Agent Code",
    changePassword: "Change Password",
    oldPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm New Password",
    updatePasswordBtn: "UPDATE PASSWORD",
    cashHistoryTitle: "Cash In / Cash Out History",
    noTransactions: "No transaction records found",
    loadingTransactions: "Loading transactions...",
    contactUsTitle: "Contact Us & Support",
    contactBot: "Official Telegram Bot",
    contactChannel: "Official Telegram Channel",
    contactPhone: "Customer Support Hotline",
    signOutBtn: "Sign Out",
    signOutConfirm: "Are you sure you want to sign out?",
    currencySymbol: "MMK",
    openTelegram: "Open Telegram →",
    joinChannel: "Join Channel →",
    approved: "Approved",
    underReview: "Under Review",
    rejected: "Rejected",
    completed: "Completed",
    txIdLabelOnly: "TxID",
    cashInAction: "Top Up",
    cashOutAction: "Withdrawal",
    winPayoutAction: "Prize Payout",
    filterAll: "ALL",
    filterDeposit: "Top Up",
    filterWithdraw: "Withdraw",
    filterPrize: "Prizes",

    // Auth Modal
    loginTitle: "Login to SG4D",
    registerTitle: "Account Register (Sign Up)",
    forgotPasswordTitle: "Reset Password",
    loginSubtitle: "Sign in with your phone number",
    forgotPasswordSubtitle: "Reset your password with Telegram OTP",
    phoneLabel: "Phone Number",
    passwordLabel: "Password",
    forgotPasswordLink: "Forgot Password?",
    loginBtn: "LOG IN",
    agentCodeLabel: "Agent / Referral Code *",
    verifiedBadge: "Verified",
    usernameLabel: "Username *",
    fullNameLabel: "Full Name",
    telegramVerificationTitle: "Telegram Verification *",
    sendOtpBtn: "Send Telegram OTP",
    resendOtpBtn: "Resend OTP",
    sendingOtp: "Sending OTP...",
    enterOtpPlaceholder: "Enter 6-digit OTP",
    verifyBtn: "Verify",
    registerBtn: "REGISTER ACCOUNT",
    userIdOrPhoneLabel: "Registered Phone Number or Username",
    userIdOrPhonePlaceholder: "e.g. 09888888888 or username",
    newPasswordLabel: "New Password *",
    resetPasswordBtn: "RESET PASSWORD",
    backToLoginBtn: "Back to Login",
    goToSignUp: "Sign up: (Create New Account)",
    goToLogin: "Already have an account? Log In"
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('sg4d_lang') || 'mm';
  });

  useEffect(() => {
    localStorage.setItem('sg4d_lang', lang);
  }, [lang]);

  const toggleLanguage = () => {
    setLang(prev => (prev === 'mm' ? 'en' : 'mm'));
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['mm']?.[key] || key;
  };

  // Convert English digits to Myanmar digits when lang === 'mm'
  const num = (val) => {
    if (val === null || val === undefined) return '';
    if (lang === 'mm') {
      return toMyanmarDigits(val);
    }
    return String(val);
  };

  // Format currency amount (e.g. 10000 -> "၁၀,၀၀၀ ကျပ်" in mm, "10,000 MMK" in en)
  const formatMoney = (val) => {
    const numVal = Number(val) || 0;
    const formatted = numVal.toLocaleString('en-US');
    if (lang === 'mm') {
      return `${toMyanmarDigits(formatted)} ကျပ်`;
    }
    return `${formatted} MMK`;
  };

  // Format raw digits / dates (e.g. "2026-10-14" -> "၂၀၂၆-၁၀-၁၄" in mm)
  const formatDigits = (val) => {
    if (lang === 'mm') {
      return toMyanmarDigits(val);
    }
    return String(val ?? '');
  };

  // Format date/time with full localization
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return formatDigits(dateVal);
    
    const pad = (n) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = d.getHours();
    const minute = pad(d.getMinutes());
    const second = pad(d.getSeconds());
    const isPm = hour >= 12;
    const hour12 = pad(hour % 12 || 12);

    if (lang === 'mm') {
      const period = isPm ? 'ညနေ' : 'နံနက်';
      return `${toMyanmarDigits(year)}-${toMyanmarDigits(month)}-${toMyanmarDigits(day)} ${period} ${toMyanmarDigits(hour12)}:${toMyanmarDigits(minute)}:${toMyanmarDigits(second)} နာရီ`;
    } else {
      const period = isPm ? 'PM' : 'AM';
      return `${year}-${month}-${day} ${hour12}:${minute}:${second} ${period} MMT`;
    }
  };

  return (
    <LanguageContext.Provider value={{
      lang,
      setLang,
      toggleLanguage,
      t,
      num,
      formatMoney,
      formatDigits,
      formatDateTime
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
