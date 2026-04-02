interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'Jason Dai Running',
  siteUrl: 'https://run.dvorakd.top',
  logo: 'https://github.com/imjasondai.png',
  description: 'Running log powered by Strava.',
  navLinks: [
    {
      name: 'Running',
      url: '/',
    },
    {
      name: 'Tracks',
      url: '/tracks',
    },
    {
      name: 'About',
      url: 'https://github.com/imjasondai',
    },
  ],
};

export default data;
