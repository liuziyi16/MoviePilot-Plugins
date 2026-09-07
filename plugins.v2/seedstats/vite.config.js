import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'
import pkg from './package.json'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'SeedStats',
      filename: 'remoteEntry.js',
      exposes: {
        './AppPage': './src/components/AppPage.vue',
        './Page': './src/components/Page.vue',
        './Config': './src/components/Config.vue',
      },
      shared: {
        vue: {
          requiredVersion: false,
          generate: false,
        },
        vuetify: {
          requiredVersion: false,
          generate: false,
          singleton: true,
        },
        'vuetify/styles': {
          requiredVersion: false,
          generate: false,
          singleton: true,
        },
      },
      format: 'esm',
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: true,
    // dist/<版本>/assets: remoteEntry.js 的 URL 随版本变化, 强制浏览器拉新, 避免更新后仍用缓存旧界面
    // (vite 默认 assetsDir='assets' 会把产物放进 dist/vX/assets/, 与 get_render_mode 返回路径保持一致)
    outDir: `dist/v${pkg.version}`,
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: atRule => {
              if (atRule.name === 'charset') {
                atRule.remove()
              }
            },
          },
        },
        {
          postcssPlugin: 'vuetify-filter',
          Root(root) {
            root.walkRules(rule => {
              if (rule.selector && (rule.selector.includes('.v-') || rule.selector.includes('.mdi-'))) {
                rule.remove()
              }
            })
          },
        },
      ],
    },
  },
})
