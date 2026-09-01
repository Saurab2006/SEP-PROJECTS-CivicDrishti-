// Nepal's 7 provinces and their real districts
export const NEPAL_PROVINCES = [
  'Koshi',
  'Madhesh',
  'Bagmati',
  'Gandaki',
  'Lumbini',
  'Karnali',
  'Sudurpashchim',
];

export const NEPAL_DISTRICTS_BY_PROVINCE = {
  Koshi: [
    'Bhojpur', 'Dhankuta', 'Ilam', 'Jhapa', 'Khotang', 'Morang', 'Okhaldhunga',
    'Panchthar', 'Sankhuwasabha', 'Solukhumbu', 'Sunsari', 'Taplejung', 'Terhathum', 'Udayapur',
  ],
  Madhesh: [
    'Bara', 'Dhanusha', 'Mahottari', 'Parsa', 'Rautahat', 'Saptari', 'Sarlahi', 'Siraha',
  ],
  Bagmati: [
    'Bhaktapur', 'Chitwan', 'Dhading', 'Dolakha', 'Kathmandu', 'Kavrepalanchok',
    'Lalitpur', 'Makwanpur', 'Nuwakot', 'Ramechhap', 'Rasuwa', 'Sindhuli', 'Sindhupalchok',
  ],
  Gandaki: [
    'Baglung', 'Gorkha', 'Kaski', 'Lamjung', 'Manang', 'Mustang', 'Myagdi',
    'Nawalpur', 'Parbat', 'Syangja', 'Tanahun',
  ],
  Lumbini: [
    'Arghakhanchi', 'Banke', 'Bardiya', 'Dang', 'Eastern Rukum', 'Gulmi',
    'Kapilvastu', 'Palpa', 'Parasi', 'Pyuthan', 'Rolpa', 'Rupandehi',
  ],
  Karnali: [
    'Dailekh', 'Dolpa', 'Humla', 'Jajarkot', 'Jumla', 'Kalikot',
    'Mugu', 'Salyan', 'Surkhet', 'Western Rukum',
  ],
  Sudurpashchim: [
    'Achham', 'Baitadi', 'Bajhang', 'Bajura', 'Dadeldhura',
    'Darchula', 'Doti', 'Kailali', 'Kanchanpur',
  ],
};

export function getDistrictsForProvince(province) {
  return NEPAL_DISTRICTS_BY_PROVINCE[province] || [];
}