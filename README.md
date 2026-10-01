# CAD 交付文件

本仓库公开制作深化图纸、可编辑CAD、三维装配查看器、两份XLSX与复核说明。

## 当前项目

[HW73005-L2000体验桌](https://lorcan-l.github.io/cad-deliverables/hw73005-l2000/)默认R03：52页图册、84件号与三维双向索引。R02六项和R01五项历史下载保持原路径与校验值。

## 文件结构

project.json记录版次、可用状态、大小和SHA256。R03下载位于files/R03，三维入口位于files/R03/viewer，公开校验与来源位于files/R03/evidence；预览来自同版最终PDF。

## 验收边界

资料发布仍为成型深化稿，未生产放行。展开补偿、结构荷载、成品配装、门盖启闭、防坠和电气须首件及实物检验；数字回读不等同接收方CAD操作验收。

## 本地及Pages

仓库根运行`python3 -m http.server 8765`。GitHub Pages从main分支根目录发布。
