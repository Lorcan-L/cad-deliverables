# CAD 交付文件

本仓库公开制作深化图纸、可编辑CAD、逐件下料、采购清单与复核说明；R03交互三维保留为历史资料。

## 当前项目

[HW73005-L2000体验桌](https://lorcan-l.github.io/cad-deliverables/hw73005-l2000/)默认R04：22页图册、83项部件、35项五金组件、19种平板激光DXF与1种矩管锯切资料。R03/R02/R01历史下载保持原路径。

[AI 接单能力蒸馏方案](https://lorcan-l.github.io/cad-deliverables/ai-order-sop/)以 R04 和工程师反馈为回放材料，提出 Skill、状态工作流、独立校验器与分级交付的实施路径；方案本身不代表生产放行。

## 文件结构

project.json记录版次、可用状态、大小和SHA256。当前文件位于files/R04；R03交互三维仍位于files/R03/viewer。预览来自各版最终PDF。

## 验收边界

R04为制造审核版，未生产放行。材料、割缝、折弯与V槽、结构荷载、五金配装及电气须首件和实物检验；数字回读不等同接收方CAD操作验收。

## 本地及Pages

仓库根运行`python3 -m http.server 8765`。GitHub Pages从main分支根目录发布。
