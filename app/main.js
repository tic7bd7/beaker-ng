require('tls').DEFAULT_ECDH_CURVE = 'auto' // HACK (prf) fix Node 8.9.x TLS issues, see https://github.com/nodejs/node/issues/19359
process.noAsar = true

// DEBUG
// Error.stackTraceLimit = Infinity
// require('events').defaultMaxListeners = 1e3 // pls stfu

// This is main process of Electron, started as first thing when your
// app starts. This script is running through entire life of your application.
// It doesn't have any windows which you can see on screen, but we can open
// window from here.

import { app, protocol, nativeTheme } from 'electron'
import { join } from 'path'

import { getEnvVar } from './bg/lib/env'
import * as logger from './bg/logger'
import * as beakerBrowser from './bg/browser'
import * as adblocker from './bg/adblocker'
import * as analytics from './bg/analytics'
import * as portForwarder from './bg/nat-port-forwarder'
import dbs from './bg/dbs/index'
import hyper from './bg/hyper/index'
import * as filesystem from './bg/filesystem/index'
import * as bookmarkPins from './bg/filesystem/pins'
import * as webapis from './bg/web-apis/bg'

import * as initWindow from './bg/ui/init-window'
import { runSetupFlow } from './bg/ui/setup-flow'
import * as windows from './bg/ui/windows'
import * as windowMenu from './bg/ui/window-menu'
import registerContextMenu from './bg/ui/context-menu'
import * as trayIcon from './bg/ui/tray-icon'
import * as downloads from './bg/ui/downloads'
import * as permissions from './bg/ui/permissions'

import * as beakerProtocol from './bg/protocols/beaker'
import * as assetProtocol from './bg/protocols/asset'
import * as hyperProtocol from './bg/protocols/hyper'
import * as datProtocol from './bg/protocols/dat'

import * as testDriver from './bg/test-driver'
import * as openURL from './bg/open-url'
import * as settingsDb from './bg/dbs/settings'
import * as electronLog from 'electron-log'

// setup
// =

const log = logger.get().child({category: 'browser', subcategory: 'init'})

// read config from env vars
if (getEnvVar('BEAKER_USER_DATA_PATH')) {
  console.log('User data path set by environment variables')
  console.log('userData:', getEnvVar('BEAKER_USER_DATA_PATH'))
  app.setPath('userData', getEnvVar('BEAKER_USER_DATA_PATH'))
}
if (getEnvVar('BEAKER_TEST_DRIVER')) {
  testDriver.setup()
}

// we know, we know
//delete process.env.ELECTRON_ENABLE_SECURITY_WARNINGS;
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;
//process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = '1'

// enable the sandbox
app.enableSandbox()

// Needed for Electron <13 on Linux
// app.commandLine.appendSwitch('no-sandbox');
// Needed for Electron <13 on Linux
//app.commandLine.appendSwitch('disable-gpu-sandbox');
// Including new Canvas2D APIs
app.commandLine.appendSwitch('new-canvas-2d-api');
// These two allow easier local web development
// Allow file:// URIs to read other file:// URIs
app.commandLine.appendSwitch('allow-file-access-from-files');
// Enable local DOM to access all resources in a tree
app.commandLine.appendSwitch('enable-local-file-accesses');
// Enable QUIC for faster handshakes
app.commandLine.appendSwitch('enable-quic');
// Enable inspecting ALL layers
app.commandLine.appendSwitch('enable-ui-devtools');
// Force enable GPU acceleration
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// Force enable GPU rasterization
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Enable Zero Copy for GPU memory associated with Tiles
app.commandLine.appendSwitch('enable-zero-copy');
// Inform GPU process that GPU context will not be lost in power saving modes
// Useful for fixing blank or pink screens/videos upon system resume, etc
app.commandLine.appendSwitch('gpu-no-context-lost');
// Enable all WebGL Features
app.commandLine.appendSwitch('enable-webgl-draft-extensions');
// Transparent overlays for Promethium UI
app.commandLine.appendSwitch('enable-transparent-visuals');

// Enable native CPU-mappable GPU memory buffer support on Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
}

// Enable useful features
if (process.platform === 'linux') {
  app.commandLine.appendSwitch(
  'enable-features','CanvasOopRasterization,CSSColorSchemeUARendering,ImpulseScrollAnimations,ParallelDownloading,Portals,StorageBuckets,JXL,VaapiVideoDecoder,VaapiVideoEncoder',
  );
}
// VAAPI is only applicable on linux so copy above without vaapi flags
if (process.platform === 'win32' || process.platform === 'darwin') {
  app.commandLine.appendSwitch(
  'enable-features','CanvasOopRasterization,CSSColorSchemeUARendering,ImpulseScrollAnimations,ParallelDownloading,Portals,StorageBuckets,JXL',
  );
}

if (process.env.NODE_ENV === 'development') {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

// HACK fix for cors in custom protocols
// See https://github.com/electron/electron/issues/20730
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

// enable process reuse to speed up navigations
// see https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = true

// configure the protocols
protocol.registerSchemesAsPrivileged([
  {scheme: 'dat', privileges: {standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true}},
  {scheme: 'hyper', privileges: {standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true}},
  {scheme: 'beaker', privileges: {standard: true, secure: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true}}
])

// handle OS event to open URLs
app.on('open-url', (e, url) => {
  e.preventDefault() // we are handling it
  // wait for ready (not waiting can trigger errors)
  if (app.isReady()) openURL.open(url)
  else app.on('ready', () => openURL.open(url))
})

// handle OS event to open files
app.on('open-file', (e, filepath) => {
  e.preventDefault() // we are handling it
  // wait for ready (not waiting can trigger errors)
  if (app.isReady()) openURL.open(`file://${filepath}`)
  else app.on('ready', () => openURL.open(`file://${filepath}`))
})

app.on('ready', async function () {
  var commonOpts = {
    userDataPath: app.getPath('userData'),
    homePath: app.getPath('home')
  }

  console.log('Welcome to Beaker Browser!')
  await logger.setup(join(commonOpts.userDataPath, 'beaker.log'))
  log.info('Starting Beaker')
  beakerProtocol.register(protocol)
  webapis.setup()
  initWindow.open()
  portForwarder.setup()

  // setup databases
  log.info('Initializing databases')
  for (let k in dbs) {
    if (dbs[k].setup) {
      dbs[k].setup(commonOpts)
    }
  }

  // start subsystems
  // (order is important)
  log.info('Starting hyperdrive')
  await hyper.setup(commonOpts)
  log.info('Initializing hyperdrive filesystem')
  await filesystem.setup()
  log.info('Initializing browser')
  await beakerBrowser.setup()
  adblocker.setup()
  analytics.setup()
  await bookmarkPins.setup()

  // protocols
  log.info('Registering protocols')
  assetProtocol.setup()
  assetProtocol.register(protocol)
  hyperProtocol.register(protocol)
  datProtocol.register(protocol)

  initWindow.close()

  // setup flow
  log.info('Running setup flow')
  await runSetupFlow()

  // ui
  log.info('Initializing window menu')
  windowMenu.setup()
  log.info('Initializing context menus')
  registerContextMenu()
  log.info('Initializing tray icon')
  trayIcon.setup()
  log.info('Initializing browser windows')
  windows.setup()
  log.info('Initializing downloads manager')
  downloads.setup()
  log.info('Initializing permissions manager')
  permissions.setup()
  log.info('Program setup complete')

  // theming
  nativeTheme.themeSource = await dbs.settings.get('browser_theme')
  dbs.settings.on('set:browser_theme', v => {
    nativeTheme.themeSource = v
  })

  var doNotTrack = await settingsDb.get('do_not_track')
  var globalPrivacyControl = await settingsDb.get('global_privacy_control')  
  electronLog.info('Do Not Track Setting: [ bool =', doNotTrack, ']')
  electronLog.info('GPC Setting: [ bool =', globalPrivacyControl, ']')
})

app.on('window-all-closed', () => {
  // do nothing
})

app.on('will-quit', async (e) => {
  if (hyper.daemon.requiresShutdown()) {
    e.preventDefault()
    log.info('Delaying shutdown to teardown the daemon')
    await hyper.daemon.shutdown()
    app.quit()
  }
})

app.on('quit', () => {
  log.info('Program quit')
  portForwarder.closePort()
})

app.on('custom-ready-to-show', () => {
  // our first window is ready to show, do any additional setup
})

// only run one instance
const isFirstInstance = app.requestSingleInstanceLock()
if (!isFirstInstance) {
  app.exit()
} else {
  handleArgv(process.argv)
  app.on('second-instance', (event, argv, workingDirectory) => {
    log.info('Second instance opened', {argv})
    handleArgv(argv)

    // focus/create a window
    windows.ensureOneWindowExists()
  })
}
function handleArgv (argv) {
  if (process.platform !== 'darwin') {
    // look for URLs, windows & linux use argv instead of open-url
    let url = argv.find(v => v.indexOf('://') !== -1)
    if (url) {
      openURL.open(url)
    }
  }
}
