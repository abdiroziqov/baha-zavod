export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/tailwind.css'],
  devtools: { enabled: false },
  typescript: {
    strict: true
  },
  runtimeConfig: {
    public: {
      appName: 'Baha',
      appSubtitle: '4 ta zavod hisobi'
    }
  },
  app: {
    head: {
      title: 'Baha',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1'
        },
        {
          name: 'description',
          content: 'Baha korxonasi uchun Oybek va Jamshid zavodlarining kunlik hisob-kitob tizimi.'
        }
      ]
    }
  }
})
