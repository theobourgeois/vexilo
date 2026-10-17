// Shared sample data for all Vexilo mockups.
// ratio = width / height of the real flag, so layouts can respect true proportions.
window.FLAGS = [
  { name: 'Maryland', code: 'us-md', index: 412, favs: 27, ratio: 1.5, year: 1904, tags: ['us-state', 'heraldic', 'quartered'], colors: ['#E8B10A', '#000000', '#B31942', '#FFFFFF'] },
  { name: 'Hong Kong', code: 'hk', index: 1288, favs: 24, ratio: 1.5, year: 1997, tags: ['region', 'floral', 'asia'], colors: ['#DE2910', '#FFFFFF'] },
  { name: 'Nepal', code: 'np', index: 2231, favs: 23, ratio: 0.82, year: 1962, tags: ['national', 'non-rectangular', 'asia'], colors: ['#DC143C', '#003893', '#FFFFFF'] },
  { name: 'Wales', code: 'gb-wls', index: 977, favs: 21, ratio: 1.667, year: 1959, tags: ['country', 'dragon', 'europe'], colors: ['#00AB39', '#FFFFFF', '#D30731'] },
  { name: 'Bhutan', code: 'bt', index: 1802, favs: 19, ratio: 1.5, year: 1969, tags: ['national', 'dragon', 'diagonal'], colors: ['#FFD520', '#FF4E12', '#FFFFFF'] },
  { name: 'Switzerland', code: 'ch', index: 309, favs: 18, ratio: 1, year: 1889, tags: ['national', 'square', 'cross'], colors: ['#DA291C', '#FFFFFF'] },
  { name: 'Kiribati', code: 'ki', index: 2610, favs: 16, ratio: 2, year: 1979, tags: ['national', 'sun', 'oceania'], colors: ['#CE1126', '#FCD116', '#003F87', '#FFFFFF'] },
  { name: 'Qatar', code: 'qa', index: 1544, favs: 15, ratio: 2.545, year: 1971, tags: ['national', 'serrated', 'middle-east'], colors: ['#8A1538', '#FFFFFF'] },
  { name: 'Brazil', code: 'br', index: 140, favs: 14, ratio: 1.43, year: 1889, tags: ['national', 'stars', 'motto'], colors: ['#009C3B', '#FFDF00', '#002776', '#FFFFFF'] },
  { name: 'Seychelles', code: 'sc', index: 2399, favs: 13, ratio: 2, year: 1996, tags: ['national', 'rays', 'africa'], colors: ['#003F87', '#FCD856', '#D62828', '#FFFFFF', '#007A3D'] },
  { name: 'Greenland', code: 'gl', index: 1960, favs: 12, ratio: 1.5, year: 1985, tags: ['territory', 'bicolor', 'arctic'], colors: ['#D00C33', '#FFFFFF'] },
  { name: 'Sri Lanka', code: 'lk', index: 2047, favs: 11, ratio: 2, year: 1972, tags: ['national', 'lion', 'asia'], colors: ['#8D153A', '#FFB700', '#00534E', '#EB7400'] },
  { name: 'Japan', code: 'jp', index: 77, favs: 10, ratio: 1.5, year: 1870, tags: ['national', 'disc', 'minimal'], colors: ['#BC002D', '#FFFFFF'] },
  { name: 'Mozambique', code: 'mz', index: 1415, favs: 9, ratio: 1.5, year: 1983, tags: ['national', 'rifle', 'africa'], colors: ['#007168', '#000000', '#FCE100', '#D21034', '#FFFFFF'] },
  { name: 'California', code: 'us-ca', index: 655, favs: 8, ratio: 1.5, year: 1911, tags: ['us-state', 'bear', 'star'], colors: ['#FFFFFF', '#B22234', '#5C3A1E'] },
  { name: 'Canada', code: 'ca', index: 2074, favs: 31, ratio: 2, year: 1965, tags: ['national', 'tricolor', 'maple-leaf'], colors: ['#FF0000', '#FFFFFF'] },
];

window.FLAG_IMG = (code) => `https://flagcdn.com/${code}.svg`;

// Featured / "flag of the day" and the detail-page subject.
window.FOTD = {
  name: 'Bhutan', code: 'bt', index: 1802, ratio: 1.5, year: 1969,
  blurb: 'Druk, the Thunder Dragon, grips jewels in its claws across a diagonal split of saffron and orange — royal authority on one side, Buddhist practice on the other.',
};

window.DETAIL = {
  name: 'Canada', code: 'ca', index: 2074, ratio: 2, year: 1965, favs: 31,
  description: "Canada’s red–white–red vertical triband with a centered 11-point maple leaf, adopted in 1965 and widely known as the Maple Leaf.",
  tags: ['national', 'tricolor', 'vertical-stripes', 'centered-emblem', 'plant', 'maple-leaf', '1965', 'north-america'],
  colors: [{ hex: '#FF0000', name: 'Red' }, { hex: '#FFFFFF', name: 'White' }],
  facts: [['Adopted', '15 Feb 1965'], ['Proportion', '1 : 2'], ['Designer', 'G. F. G. Stanley'], ['Type', 'National flag'], ['Source', 'commons.wikimedia.org']],
  traits: [['Layout', 'Canadian pale', '3%'], ['Emblem', 'Maple leaf', '<1%'], ['Colours', '2', '21%'], ['Stripes', 'Vertical', '14%']],
  related: [{ name: 'United States', code: 'us' }, { name: 'Peru', code: 'pe' }, { name: 'Lebanon', code: 'lb' }, { name: 'Nigeria', code: 'ng' }],
};

window.TAGS = [['national', 4210], ['us-state', 312], ['municipality', 236], ['military', 223], ['historical', 1820], ['tricolor', 640], ['proposal', 512], ['fictional', 288], ['heraldic', 455], ['stars', 701]];
