# ArrowPrompt - AI编码快捷键插件

通过方向键快速发送AI提示词的Chrome扩展。

## 功能

- ↑ 键：解释这段代码
- ↓ 键：优化一下
- ← 键：修复这个bug
- → 键：换成中文

## 支持的网站

- Claude.ai
- ChatGPT
- Gemini

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 持续构建（文件变化自动重新构建）
npm run watch
```

## 安装到Chrome

1. 运行 `npm run build`
2. 打开 Chrome 扩展管理页面 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 文件夹

## 目录结构

```
src/
├── background/     # 后台脚本
├── content/        # 内容脚本
├── popup/          # 弹窗UI
└── utils/          # 工具函数
```

## 图标

在 `public/icons/` 目录下添加以下图标文件：
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## 技术栈

- React + TypeScript
- Vite
- Chrome Extension Manifest V3
