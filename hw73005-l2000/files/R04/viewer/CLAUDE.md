# viewer/
> L2 | 父级: ../CLAUDE.md

index.html: R04三维装配入口，含部件、孔路线、分离及图册跳转。
viewer.js: 读取R04网格/索引/路线，控制选件、旋转、分离、孔位与PDF页跳转。
viewer.css: 桌面与手机响应式查看布局；颜色使用本页CSS变量。
assembly.json: 从冻结R04装配模型生成的464实例WebGL网格，仅保留渲染字段。
index.json: 正式BOM 83件号与22页图框的图号/页码/材质/数量映射。
routes.json: 从冻结R04模型生成的39路线和39孔定位及图页索引。
vendor/: 本地Three.js、OrbitControls及MIT许可，无外部CDN依赖。

三维用于定位和检修沟通；加工尺寸以R04正式DWG/PDF为准，未生产放行。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
