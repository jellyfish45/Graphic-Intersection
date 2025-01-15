<template>
  <div class="wrapper">
    <div class="sidebar">
      <ul class="menu">
        <template v-for="item in list">
          <a-tooltip :title="item.name">
            <li
              class="menu-item"
              :class="{selected: item.id === selectedShape}"
              @click="onChooseShape(item)"
            >
              <i class="icon iconfont icon-duobianxing" :class="item.icon"></i>
            </li>
          </a-tooltip>
        </template>
      </ul>
    </div>
    <div class="main">
      <div class="header">
        <a-space>
          <a-tooltip title="撤销">
            <a-button class="btn-revert" type="primary" @click="onRevert">
              <template #icon>
                <i class="icon iconfont icon-weibiaoti545"></i>
              </template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="选择图形">
            <a-button class="btn-selection" :type="selectionMode ? 'primary' :  'default'" @click="selectionMode = !selectionMode">
              <template #icon>
                <i class="icon iconfont icon-xuanze"></i>
              </template>
            </a-button>
          </a-tooltip>
          <a-button type="primary" :disabled="selectedShapeId.length < 2" @click="onCalcIntersectionPoints">计算交点</a-button>
        </a-space>
      </div>
      <div class="content" ref="content">
        <div class="x-axis" :style="{width: xAxisList.length * splitVal * pixelRatio + 'px'}"><div :style="{width: splitVal * pixelRatio + 'px'}" v-for="(item, i) in xAxisList"><span>{{ i > 0 ? item : '' }}</span></div></div>
        <div class="y-axis" :style="{height: yAxisList.length * splitVal * pixelRatio + 'px'}"><div :style="{height: splitVal * pixelRatio + 'px'}" v-for="(item, i) in xAxisList"><span>{{ i > 0 ? item : '' }}</span></div></div>
        <canvas ref="designer"></canvas>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { throttle } from 'lodash'
import * as turf from '@turf/turf'

const list = ref([
  { id: 'line', name: '线段：点击确认开始端点，移动预览线段，再次点击确认结束端点', icon: 'icon-xianduan' },
  { id: 'circle', name: '圆：点击选择圆心，移动预览圆，再次点击确认圆', icon: 'icon-huayuan' },
  { id: 'polygon', name: '多边形：点击确认开始端点，移动预览多边形的边，再次点击确认多边形的边，不断重复，直至选择的端点与开始端点重合来闭合多边形', icon: 'icon-huaduobianxing' }
])
const content = ref()
const designer = ref()
const ctx = ref()
const historys = ref([])
const selectedShape = ref()
const startPoint = ref(null)
const latestPoint = ref(null)
const newId = ref('')
const nearStart = ref(false)
const selectionMode = ref(false)
const shapes = ref([])
const hoveredShapeId = ref(null)
const selectedShapeId = ref([])
const intersections = ref([])
const splitVal = ref(50)
const xAxisList = ref([])
const yAxisList = ref([])
const pixelRatio = ref(window.devicePixelRatio)

const circlePoints = (center, r, steps = 64) => {
  const points = Array.from({ length: steps }).map((_, i) => {
    const deg = Math.PI * 2 / 360 * i * (360 / steps)
    return [center[0] + Math.sin(deg) * r, center[1] - Math.cos(deg) * r]
  })
  return [...points, points[0]]
}

const onChooseShape = (item) => {
  selectedShape.value = item.id
}

const startDrawLine = (e) => {
  if (startPoint.value === null) {
    startPoint.value = [e.offsetX, e.offsetY]
    newId.value = uuidv4()
  } else {
    historys.value.push({
      id: newId.value,
      action: 'line',
      value: [...startPoint.value, e.offsetX, e.offsetY]
    })
    const lineShape = turf.lineString([[...startPoint.value], [e.offsetX, e.offsetY]], { id: newId.value })
    shapes.value.push(lineShape)
    startPoint.value = null
    newId.value = ''
  }
  clear()
  drawGraphByHistory()
}

const startDrawCircle = (e) => {
  if (startPoint.value === null) {
    startPoint.value = [e.offsetX, e.offsetY]
    newId.value = uuidv4()
  } else {
    historys.value.push({
      id: newId.value,
      action: 'circle',
      value: [...startPoint.value, e.offsetX, e.offsetY]
    })
    const r = ((startPoint.value[0] - e.offsetX) ** 2 + (startPoint.value[1] - e.offsetY) ** 2) ** 0.5
    let points = circlePoints(startPoint.value, r, 360)
    const circleShape = turf.polygon([points], { id: newId.value })
    shapes.value.push(circleShape)
    startPoint.value = null
    newId.value = ''
  }
  clear()
  drawGraphByHistory()
}

const startDrawPolygon = (e) => {
  if (startPoint.value === null) {
    startPoint.value = [e.offsetX, e.offsetY]
    newId.value = uuidv4()
    latestPoint.value = [e.offsetX, e.offsetY]
  } else {
    if (nearStart.value) {
      historys.value.push({
        id: newId.value,
        action: 'line',
        value: [...latestPoint.value, startPoint.value[0], startPoint.value[1]],
        isPolygonLine: true
      })
      const points = historys.value.filter(item => item.id === newId.value)
      const polygonShape = turf.polygon([[...points.map(item => [item.value[0], item.value[1]]), [points[0].value[0], points[0].value[1]]]], { id: newId.value })
      shapes.value.push(polygonShape)
      startPoint.value = null
      newId.value = ''
      latestPoint.value = null
      nearStart.value = false
    } else {
      historys.value.push({
        id: newId.value,
        action: 'line',
        value: [...latestPoint.value, e.offsetX, e.offsetY],
        isPolygonLine: true
      })
      latestPoint.value = [e.offsetX, e.offsetY]
    }
  }
  clear()
  drawGraphByHistory()
}

const drawPoint = (x, y, r = 1, color = 'rgba(64, 158, 255, 0.5)', needPosText = false) => {
  ctx.value.save()
  ctx.value.beginPath()
  ctx.value.fillStyle = color
  ctx.value.arc(x, y, r, 0, Math.PI * 2)
  ctx.value.fill()
  ctx.value.closePath()
  ctx.value.restore()
  if (needPosText) {
    ctx.value.save()
    ctx.value.beginPath()
    ctx.value.fillStyle = '#000'
    const text = `[${parseFloat(x).toFixed(2)}, ${parseFloat(y).toFixed(2)}]`
    const textMeasure = ctx.value.measureText(text)
    ctx.value.fillText(text, x - textMeasure.width / 2, y + 14)
    ctx.value.closePath()
    ctx.value.restore()
  }
}

const drawLine = (x1, y1, x2, y2, id, hovered = false, selected = false, dash = []) => {
  if (startPoint.value && newId.value === id) {
    if (selectedShape.value === 'polygon') {
      const [sX, sY] = startPoint.value
      const d = ((sX - x2) ** 2 + (sY - y2) ** 2) ** 0.5
      const lines = historys.value.filter(e => e.id === newId.value)
      if (d <= 3 && lines.length >= 2) {
        drawPoint(sX, sY, 5)
        nearStart.value = true
      } else {
        drawPoint(x1, y1, 3)
        nearStart.value = false
      }
    } else {
      drawPoint(x1, y1, 3)
    }
  }
  ctx.value.save()
  ctx.value.beginPath()
  ctx.value.moveTo(x1, y1)
  ctx.value.lineTo(x2, y2)
  ctx.value.setLineDash(dash)
  if (hovered || selected) {
    ctx.value.strokeStyle = '#409EFF'
  }
  ctx.value.stroke()
  ctx.value.closePath()
  ctx.value.restore()
}

const drawCircle = (x1, y1, x2, y2, id, hovered = false, selected = false) => {
  if (startPoint.value && selectedShape.value === 'circle' && newId.value === id) {
    drawPoint(x1, y1, 3)
    drawLine(x1, y1, x2, y2, '', false, false, [2, 2])
  }
  ctx.value.save()
  ctx.value.beginPath()
  const r = ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5
  ctx.value.arc(x1, y1, r, 0, Math.PI * 2)
  if (hovered || selected) {
    ctx.value.strokeStyle = '#409EFF'
  }
  ctx.value.stroke()
  ctx.value.closePath()
  ctx.value.restore()
}

const drawGraphByHistory = () => {
  historys.value.forEach(item => {
    switch (item.action) {
      case 'point':
        drawPoint(...item.value, item.id)
        break
      case 'line':
        drawLine(...item.value, item.id, item.hovered, item.selected)
        break
      case 'circle':
        drawCircle(...item.value, item.id, item.hovered, item.selected)
        break
      case 'polygon':
        break
    }
  })
  drawIntersections()
}

const drawIntersections = () => {
  intersections.value.forEach(point => {
    drawPoint(...point, 5, 'yellow', true)
  })
}

const draw = (e) => {
  if (selectionMode.value) {
    if (hoveredShapeId.value !== '') {
      const shape = historys.value.filter(item => item.id === hoveredShapeId.value)
      shape.forEach(item => {
        item.selected = true
        selectedShapeId.value.push(item.id)
      })
    }
  } else {
    switch (selectedShape.value) {
      case 'line':
        startDrawLine(e)
        break
      case 'circle':
        startDrawCircle(e)
        break
      case 'polygon':
        startDrawPolygon(e)
        break
    }
  }
}

const clear = () => {
  ctx.value.clearRect(0, 0, designer.value.width, designer.value.height)
}

const drawLineMoving = (e) => {
  if (startPoint.value !== null) {
    clear()
    drawGraphByHistory()
    drawPoint(...startPoint.value)
    drawLine(...startPoint.value, e.offsetX, e.offsetY, newId.value, false, false, [2, 2])
  }
}

const drawCircleMoving = (e) => {
  if (startPoint.value !== null) {
    clear()
    drawGraphByHistory()
    drawPoint(...startPoint.value)
    drawCircle(...startPoint.value, e.offsetX, e.offsetY, newId.value, false, false)
  }
}

const drawPolygonMoving = (e) => {
  if (latestPoint.value !== null) {
    clear()
    drawGraphByHistory()
    drawPoint(...latestPoint.value)
    drawLine(...latestPoint.value, e.offsetX, e.offsetY, newId.value, false, false, [2, 2])
  }
}

const boolPointOnLine = (line, point) => {
  const [x1, y1, x2, y2] = line
  const [px, py] = point
  let val = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
  return Math.abs(val) < 1000
}

const boolPointOnCircle = (center, r, point) => {
  const [x, y] = center
  const [px, py] = point
  const d = ((px - x) ** 2 + (py - y) ** 2) ** 0.5
  return Math.abs(d -r) < 3
}

const reset = () => {
  hoveredShapeId.value = null
  historys.value.forEach(item => {
    item.hovered = false
  })
}

const checkOnShape = (e) => {
  const { offsetX: x, offsetY: y } = e
  reset()
  historys.value.forEach(item => {
    const { action, value, id } = item
    switch (action) {
      case 'line':
        const isOnLine = boolPointOnLine([value[0], value[1], value[2], value[3]], [x, y])
        if (isOnLine) {
          hoveredShapeId.value = id
          historys.value.forEach(item => {
            if (item.id === id) {
              item.hovered = true
            } else {
              item.hovered = false
            }
          })
        }
        break
      case 'circle':
        const r = ((value[0] - value[2]) ** 2 + (value[1] - value[3]) ** 2) ** 0.5
        const isOnCircle = boolPointOnCircle([value[0], value[1]], r, [x, y])
        if (isOnCircle) {
          hoveredShapeId.value = id
          historys.value.forEach(item => {
            if (item.id === id) {
              item.hovered = true
            } else {
              item.hovered = false
            }
          })
        }
        break
    }
  })
  clear()
  drawGraphByHistory()
}

const moving = (e) => {
  if (selectionMode.value) {
    checkOnShape(e)
  } else {
    switch (selectedShape.value) {
      case 'line':
        drawLineMoving(e)
        break
      case 'circle':
        drawCircleMoving(e)
        break
      case 'polygon':
        drawPolygonMoving(e)
        break
    }
  }
}

const initGraphEvent = () => {
  designer.value.addEventListener('click', throttle(draw, 10))
  designer.value.addEventListener('mousemove', throttle(moving, 10))
}

const onRevert = () => {
  if (historys.value.length > 0) {
    historys.value.pop()
    clear()
    drawGraphByHistory()
  }
}

const onCalcIntersectionPoints = () => {
  const selectedShapes = [...new Set(selectedShapeId.value)].map(id => shapes.value.find(e => e.properties.id === id))
  const intersection = turf.lineIntersect(...selectedShapes);
  if (intersection.features.length > 0) {
    intersection.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        intersections.value.push(feature.geometry.coordinates)
      }
    })
  }
  drawIntersections()
}

onMounted(() => {
  const { width, height } = content.value.getBoundingClientRect()
  ctx.value = designer.value.getContext('2d')
  designer.value.style.width = `${width}px`
  designer.value.style.height = `${height}px`
  designer.value.width = width * pixelRatio.value
  designer.value.height = height * pixelRatio.value
  ctx.value.translate(0.5, 0.5)
  ctx.value.scale(pixelRatio.value, pixelRatio.value)

  xAxisList.value = Array.from({ length: Math.ceil(width / splitVal.value) }).map((_, i) => i * splitVal.value)
  yAxisList.value = Array.from({ length: Math.ceil(width / splitVal.value) }).map((_, i) => i * splitVal.value)

  initGraphEvent()
})
</script>

<style lang="scss" scoped>
.wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-self: flex-start;

  & > .sidebar {
    width: 20%;
    border-right: 1px solid #ccc;
    padding: 10px;

    .menu {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 10px;

      &-item {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        border-radius: 3px;
        border: 1px solid #ccc;
        cursor: pointer;
        transition: all .3s;
        
        & > .icon {
          font-size: 20px;
        }

        &.selected {
          border-color: rgb(64, 158, 255);
          color: #409EFF;

          .icon {
            font-size: 24px;
          }
        }

        &:hover {
          border-color: #409EFF;
          color: #409EFF;

          .icon {
            font-size: 24px;
          }
        }
      }
    }
  }

  & > .main {
    flex: 1;
    height: 100%;

    & > .header {
      display: flex;
      justify-content: flex-start;
      align-self: center;
      height: 50px;
      border-bottom: 1px solid #ccc;
      padding-left: 10px;

      .ant-space {
        width: 100%;
      }

      .btn-revert, .btn-selection {
        display: flex;
        justify-content: center;
        align-self: center;

        & > .icon {
          font-size: 22px;
          line-height: 22px;
        }
      }

      .btn-selection {
        & > .icon {
          transform: translate(2px, 2px);
          font-size: 18px;
          line-height: 18px;
        }
      }
    }

    & > .content {
      position: relative;
      height: calc(100% - 50px);
      background-color: rgba(0, 0, 0, 0.03);

      .x-axis {
        position: absolute;
        left: 0;
        top: 0;
        height: 10px;
        display: flex;
        font-size: 8px;
        color: rgba(0, 0, 0, 0.4);
        
        & > li {
          display: line-block;
          border-right: 1px solid rgba(0, 0, 0, 0.4);

          & > span {
            display: inline-block;
            transform: translate(5px, 10px);
          }
        }
      }

      .y-axis {
        position: absolute;
        left: 0;
        top: 0;
        width: 10px;
        display: flex;
        flex-direction: column;
        font-size: 8px;
        color: rgba(0, 0, 0, 0.4);

        & > li {
          display: line-block;
          border-bottom: 1px solid rgba(0, 0, 0, 0.4);

          & > span {
            display: inline-block;
            transform: translate(10px, -5px);
          }
        }
      }
    }
  }
}
</style>
