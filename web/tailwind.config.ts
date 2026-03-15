module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif:    ['"Playfair Display"', 'Georgia', 'serif'],
        headline: ['"UnifrakturMaguntia"', 'serif'], // for the masthead
        body:     ['Georgia', 'serif'],
      },
      colors: {
        newsprint: '#f5f1e8',
        ink:       '#1a1a1a',
        column:    '#d4cdb8',
      },
    },
  },
  plugins: [],
};
