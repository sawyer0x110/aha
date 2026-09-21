# 格陵兰为何在墨卡托地图上显得巨大？

## 直接回答
这不是所有世界地图的共同问题。普通墨卡托投影越靠近两极，面积放大越严重。格陵兰位于高纬地区，所以在这类地图上显得异常巨大；按常用面积统计，非洲约为格陵兰的14倍。[e-greenland][e-africa][e-mercator]

## 范围、方法与问题树
为一般成年观众解释反直觉现象，研究报告用中文，后续视频使用英文。时间范围是2026-09-16可访问的来源；预算为针对决定性问题的一轮来源检索及定向补查，不穷尽投影史。问题树先比较面积(q-area)，再解释放大机制(q-mechanism)，最后检查用途与边界(q-tradeoff)以及可合法复现的地图材料(q-resource)。q-primary单列官方统计正文核验缺口。没有研究政治动机、地图对心理的因果影响或实际航海导航。研究代理实际阅读与反向检查记录由主协调者编入本档案，不将其当作主协调者独立重复研究。

## 面积：约14倍，而非精确装箱
IndexMundi的Greenland Area页面列出2,166,086平方公里，注明包括冰盖覆盖区域，来源为CIA World Factbook，页面更新2021-09-18。Britannica Africa页面给出约30,365,000平方公里。比值约14.018，适合表达为约14倍；画面可用217万和3040万平方公里的约数。不能把格陵兰无冰区当总面积，不能说14个轮廓一定可以无重叠放进非洲。来源并非统一测量流程，使用约数避免伪精确。[e-greenland][e-africa]

官方Statistics Greenland 2026 PDF被找到并访问，但正文提取失败；CIA旧网址重定向至退役公告。因此不声称本次直接核验了官方PDF内的数字。公开二手数字足以支持数量级比较，此缺口保留在q-primary。

## 机制：球面上的距离与纸上的间距不同
球面上，经线向极点汇聚，同一经度差的东西距离随纬度增大而缩短。普通墨卡托图上经线却始终等距。因此越往高纬，东西方向越被放大。为了保留局部角度，南北方向必须同样放大，纬线间距也随之增加。[e-proj][e-mercator]

对赤道比例为1的球面模型，PROJ给出x=Rλ、y=R ln tan(π/4+φ/2)。从公式求导并与球面距离比较，可得局部线性倍率sec(φ)，局部面积倍率sec²(φ)。在60度附近的微小区域，两方向各约2倍、面积约4倍。这是对公式的数学推导，不是来源直接给出的整国倍率。格陵兰横跨不同纬度，不可给整个轮廓统一乘一个系数；非洲也不能用单个纬度概括。[e-proj]

## 墨卡托没有画错，而是在取舍
普通墨卡托在无穷小范围保角，不意味着大陆整体形状或面积不变。恒定罗盘航向的恒向线在普通墨卡托上是直线，但通常不是最短路线。两极对应无穷远，因此有限地图必须裁切纬度范围。Web Mercator将椭球纬度代入球面公式，严格性质与普通椭球墨卡托不同；视频应明确标注Spherical Mercator，避免混用。[e-mercator]

把球面画成平面必有变形。Equal Earth是等面积投影，保留面积比例，却仍改变形状、角度、方向与距离。不能称它为唯一正确地图：比较面积时它合适，普通墨卡托则有局部保角与恒向线表达的用途。[e-flat][e-equalearth]

## 数据与动画复现边界
Natural Earth 1:110 million Countries将格陵兰与丹麦分列，数据为公共领域，可修改与再分发。110m表示1:1.1亿概化尺度，不是110米精度。实际下载后须记录来源版本和哈希，不能从商业来源截图复制地图。[e-boundaries][e-license]

动画建议：将实际格陵兰边界转换为球面单位向量，对所有顶点应用同一个三维旋转，再投影到固定的球面墨卡托地图。旋转保持球面面积，但纸上的轮廓改变；不能用二维等比缩小冒充地理计算。D3提供geoRotation与球面geoArea，可用于实现和不变量检查。这是推导的实现方案，还不是执行成功的实验。低分辨率边界计算面积不应冒充精确统计值，动画须保持固定地图尺度、处理环方向和裁切。[e-d3]

## 反向核查与停止理由
已对主要句子检查对象、条件、单位与推理桥梁：保留“墨卡托而非所有地图”“局部而非整个国家”“约14倍而非装箱”“恒向线而非最短路径”。PROJ公式与Esri性质说明互相补充，不以来源数量投票。官方统计正文访问缺口明确保留；动画数值、视觉和听看验收尚未执行。结构校验与哈希不能证明事实。核心机制、数量级、反例与资源许可已覆盖，继续追逐失败PDF不会明显改变保守结论，因此停止来源扩展，进入作品制作。

## 来源
- e-greenland: https://www.indexmundi.com/greenland/area.html
- e-africa: https://www.britannica.com/place/Africa
- e-proj: https://raw.githubusercontent.com/OSGeo/PROJ/9.9/docs/source/operations/projections/merc.rst
- e-mercator: https://pro.arcgis.com/en/pro-app/3.6/help/mapping/properties/mercator.htm
- e-flat: https://www.britannica.com/science/map/Map-projections
- e-equalearth: https://doc.esri.com/en/arcgis-pro/latest/help/mapping/properties/equal-earth.html
- e-boundaries: https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/
- e-license: https://www.naturalearthdata.com/about/terms-of-use/
- e-d3: https://raw.githubusercontent.com/d3/d3/main/docs/d3-geo/math.md