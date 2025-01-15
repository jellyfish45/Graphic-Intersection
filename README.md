# Graphic-Intersection
## 安装说明
### Mac系统 安装Vue3环境
1. 下载Node.js <br />
[官网链接](https://nodejs.org/en/download)
2. 检验是否安装成功
```
node -v
npm -v
```
4. 安装Vue
```
sudo npm install webpack -g
```
5. 安装Vue CLI（脚手架）
```
sudo npm install -g @vue/cli
```
6. 运行Graphic-Intersection项目
```
cd Graphic-Intersection
npm run dev
```
### Linux/Windows系统 安装Vue3环境
由于本人设备系统是MacOS系统，所以无法实操Linux/Window系统配置Vue3。详细操作可见[Microsoft 指南](https://learn.microsoft.com/zh-cn/windows/dev-environment/javascript/vue-on-wsl)。

## 功能说明
### 绘图
- 圆：点击选择圆心，移动预览圆，再次点击确认圆
- 线段：点击确认开始端点，移动预览线段，再次点击确认结束端点
- 多边形：点击确认开始端点，移动预览多边形的边，再次点击确认多边形的边，不断重复，直至选择的端点与开始端点重合来闭合多边形
绘制错误可点击页面左上方“撤销”键重新输入。
### 相交计算
首先点击页面左上方“选择图形”键选择任意**两个**图形。再点击页面左上方“计算相交”键计算其交点，交点的位置和坐标会显示在画布上。

## 特殊说明：
功能的实现需要严格遵循绘制图形-（撤销）-选择图形-计算相交的步骤进行。如果出现其他任何错误或者需要计算新的图形的相交结果，请重新启动程序进行计算。
