import { createApp } from 'vue'
import './style.scss'
import { Button, Tooltip, Space } from 'ant-design-vue'
import App from './App.vue'
import '@/assets/font/iconfont.css'

const app = createApp(App)

app.use(Button)
app.use(Tooltip)
app.use(Space)

app.mount('#app')
