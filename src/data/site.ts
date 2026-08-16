export const site = {
  name: 'Life行政書士事務所',
  tagline: '都市計画法・盛土規制法・農地法の許認可申請',
  description:
    '岐阜県揖斐郡池田町のLife行政書士事務所。開発許可（都市計画法29条）・建築許可（43条）・60条証明・盛土規制法・農地転用・河川法・占用許可など、土地に関する許認可申請を岐阜県・愛知県・三重県で承ります。',
  url: 'https://office-lifechange.com',
  representative: '髙橋 一浩',
  postal: '〒503-2422',
  address: '岐阜県揖斐郡池田町八幡998番地',
  tel: '090-7690-7557',
  registrationNo: '19200212',
  invoiceNo: 'T9810538173507',
  hours: '平日 9:00〜18:00・メールフォームは24時間受付',
  personalBlog: 'https://kazutcha.com',
};

export const nav = [
  { href: '/services/', label: '業務一覧' },
  { href: '/area/', label: '対応エリア' },
  { href: '/partners/', label: '士業・事業者の方へ' },
  { href: '/about/', label: '事務所について' },
  { href: '/contact/', label: 'お問い合わせ' },
];

export const areas = [
  { pref: '岐阜県', note: '全域', cities: [] as string[] },
  {
    pref: '愛知県',
    note: '',
    cities: ['名古屋市', '一宮市', '稲沢市', '清須市', '犬山市', '小牧市', '春日井市', '北名古屋市', '愛西市', '津島市', 'あま市', '弥富市'],
  },
  {
    pref: '三重県',
    note: '',
    cities: ['桑名市', 'いなべ市', '東員町', '菰野町', '四日市市', '鈴鹿市', '松阪市'],
  },
];
