const path = require('path')

function resolve (dir) {
  return path.join(__dirname, '.', dir)
}
module.exports = {
  lintOnSave: false,
  publicPath: './',
  chainWebpack: config => {
    config.resolve.alias
      .set('static', resolve('public/static'))
    config.module.rules.delete('svg') // 重点：删除默认配置中处理svg,
    config.module
      .rule('svg-sprite-loader')
      .test(/\.svg$/)
      .include
      .add(resolve('src/icons')) // 处理svg目录
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]'
      })
  },
  devServer:{
    open: false, // 启动服务后是否打开浏览器
    //host: '0.0.0.0',
    // public: '0.0.0.0',
    port: 8080, // 服务端口
    https: false,
    hotOnly: false,
    hot:true,
    // 设置代理
    proxy: {
        '/api': {
            //target: 'http://192.168.1.250:8886',
            target: 'https://aiot.inphasecxzx.cn',
            //target:'http://182.151.58.57:30085',
            changeOrigin: true,
            pathRewrite: {
                '^/api': '/'//这里理解成用‘/api’代替target里面的地址，后面组件中我们掉接口时直接用api代替 比如我要调用'http://40.00.100.100:3002/user/add'，直接写‘/api/user/add’即可
            }
        }
    },
    before: app => {}
  }

}
