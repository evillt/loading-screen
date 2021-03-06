// Maybe have better way to handle the {server}

const { ProgressPlugin: Plugin } = require('webpack')

module.exports = class ProgressPlugin extends Plugin {
  constructor(opts = {}) {
    super()
    this.env = opts.env || process.env.NODE_ENV || 'development'

    this.isProd = this.env === 'production'

    this.opts = Object.assign(
      {
        baseURL: '/',
        logo: 'https://webpack.js.org/assets/icon-square-big.svg',
        host: 'localhost',
        port: process.env.port || 4000,
        callback: () => {
          if (this.isProd) return
          console.log(`[loading screen]:  http://localhost:${this.opts.port}`)
        },
        theme: {
          client: '#8ed5fb',
          server: '#1b78bf',
          modern: '#2f495e'
        },
        showPercent: true
      },
      opts
    )

    this.connections = new Set()

    this.handler = (per, message, ...details) => {
      if (this.opts.handler) {
        this.opts.handler(per, message, ...details)
      }

      this.updateProgress(per, message, ...details)
    }

    this.init()
  }

  apply(compiler) {
    super.apply(compiler)

    compiler.hooks.done.tap('LoadingScreen:done', () => {
      this.closeServer()
    })
  }

  async init() {
    const LoadingUI = require('./loading')
    this.loading = new LoadingUI(this.opts)

    const { app, wss } = await this.loading.init()

    this.server = app.listen(this.opts.port, this.opts.host, this.opts.callback)
    this.server
      .on('upgrade', (req, socket, head) => {
        if (req.url === `${this.opts.baseURL}_loading/ws`) {
          this.loading.handleUpgrade(req, socket, head)
        }
      })
      .on('connection', connection => {
        this.connections.add(connection)
      })

    wss.on('connection', ws => {
      ws.on('close', () => {
        this.closeServer('connection')
      })
    })
  }

  updateProgress(per, message, ...details) {
    this.loading.setStates([
      {
        name: 'client',
        progress: Math.floor(per * 100),
        message,
        details
      }
    ])
  }

  closeServer(type) {
    this.server.close()
    if (type === 'connection') {
      this.connections.forEach(connection => {
        connection.destroy()
      })
    }
  }
}
