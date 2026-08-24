# MiaoMiaoVerse：PostgreSQL × MongoDB 数据库面试手册

> 适用对象：工作中使用过 MongoDB，但希望补齐底层认知与面试表达；当前主要学习 PostgreSQL，并需要把 SQLModel、JSONB、pgvector 和真实项目联系起来。
>
> 时间安排：总复习计划的 Day 6–7，每天 5–6 小时。目标不是背命令，而是能根据访问模式设计模型、索引与事务，并用执行计划验证。

## 0. 完成后的能力目标

你应该能回答：

1. MongoDB 的文档模型不等于“无需 Schema”，建模为什么必须从访问模式出发？
2. embedding 和 reference 如何选择？如何识别无界数组、热点文档和 16 MiB 限制？
3. Compound、multikey、partial、TTL、hashed 等索引分别解决什么问题？索引顺序怎么定？
4. Aggregation Pipeline 怎样执行，`$match`、`$unwind`、`$lookup`、`$group` 为什么可能很贵？
5. MongoDB 单文档原子性、多文档事务、read concern、write concern 和 read preference 各控制什么？
6. 副本集如何选主，分片集群由哪些角色组成，什么是 scatter-gather？
7. PostgreSQL 的 MVCC、隔离级别、锁、deadlock、VACUUM 和 autovacuum 有什么关系？
8. B-tree、GIN、GiST、BRIN、partial、expression 和 covering index 怎么选？
9. 如何阅读 `EXPLAIN (ANALYZE, BUFFERS)`，为什么“建了索引却没用”不一定是问题？
10. PostgreSQL JSONB 和 MongoDB 文档模型如何取舍？本项目为什么让 JSONB、关系表和 pgvector 共存？

---

## 1. 先做一张认知地图

### 1.1 概念映射

| MongoDB | PostgreSQL | 注意 |
| --- | --- | --- |
| database | database | PostgreSQL database 内通常还有 schema |
| collection | table | collection 也应有验证规则和索引，不代表随意结构 |
| document | row | BSON 文档可嵌套；row 可借助 JSONB 保存半结构数据 |
| `_id: ObjectId` | primary key / UUID / identity | ObjectId 含时间成分但不应被当成完整业务时间或安全随机值 |
| embedded document/array | 子表 + FK，或 JSONB | 取决于一致性、查询、更新和增长模式 |
| reference | foreign key-like value | MongoDB 默认不强制引用完整性；应用需维护 |
| Mongoose schema | DDL constraint + ORM model | Mongoose 验证主要在应用层，数据库仍可能被其他写入绕过 |
| session/transaction | connection/session/transaction | 都不能跨请求无限持有 |
| aggregation pipeline | SELECT/JOIN/GROUP/window/CTE | 两者执行模型不同，不应机械逐语句翻译 |

### 1.2 查询语言映射

| MongoDB | PostgreSQL |
| --- | --- |
| `$match` | `WHERE` / `HAVING` |
| `$project` | `SELECT` 列与表达式 |
| `$sort` | `ORDER BY` |
| `$limit` / `$skip` | `LIMIT` / `OFFSET` |
| `$group` | `GROUP BY` + aggregate |
| `$lookup` | `JOIN` |
| `$unwind` | 展开数组，可类比 `unnest`/lateral join |
| `$set` / `$addFields` | SELECT expression 或 UPDATE SET |
| `$facet` | 多个子 pipeline，可类比一次输入上的多个子查询 |
| `$merge` / `$out` | 将结果写表/物化过程 |

### 1.3 不要把选型简化为 SQL vs NoSQL

数据库选型至少要问：

- 数据之间是否存在强关系和跨实体约束？
- 最常见读写路径是什么？需要一次读取完整 aggregate 吗？
- 更新是否频繁发生在嵌套部分？文档是否无界增长？
- 是否需要复杂 join、分析查询、窗口函数或强事务？
- 水平扩展、地域部署、团队经验与运维能力如何？
- 是否需要全文、地理、时序、JSON 或向量能力？现有数据库能否满足？
- 备份恢复、审计、迁移和成本要求是什么？

“MongoDB 灵活、PostgreSQL 结构严格”只是起点。灵活意味着 Schema 演进责任转到应用和数据治理；严格约束则能让数据库主动拒绝坏数据。

---

## 2. MongoDB 基础：从 BSON 到 Schema

### 2.1 BSON 与常见类型陷阱

MongoDB 存储 BSON，不是纯 JSON。除 string/boolean/array/document 外，还有 ObjectId、Date、Decimal128、Binary、Timestamp、Regex 等。

- **ObjectId**：通常 12 bytes，默认生成近似递增且包含秒级时间信息。它适合唯一标识，但业务排序最好使用明确的 `createdAt`，权限判断也不能依赖 ID 难猜。
- **Date**：存储 UTC 毫秒时间点，时区是展示/业务规则；不要把无时区字符串当 Date。
- **Decimal128**：金融金额不应使用二进制浮点；需在应用序列化层正确处理。
- **缺失字段与 `null`**：查询语义可能同时匹配缺失和 null，唯一/稀疏/partial 索引行为也会受影响。Schema 中应明确“未知”“未提供”“空值”是否不同。
- **数字类型**：Int32、Int64、Double、Decimal128 不完全等价；跨 JS 驱动时尤其注意超过安全整数范围。
- **字段顺序与文档大小**：BSON 保留字段顺序并带类型/字段名开销；单文档上限是 16 MiB。

### 2.2 MongoDB 不是 Schema-less，而是 Schema-flexible

Collection 可以同时存在不同形状的文档，但生产系统仍需要：

- 数据库 `$jsonSchema` validator，阻止明显非法类型/必填缺失。
- 应用层 Schema，例如 Mongoose/Zod/Pydantic，提供更友好的错误与领域校验。
- 明确的 `schemaVersion` 和向前/向后兼容策略。
- migration/backfill 脚本、灰度读写和数据质量监控。
- 对绕过应用层写入的 ETL、管理脚本和其他服务进行约束。

一次安全的字段迁移通常是：先让读路径兼容新旧字段 → 双写/写新字段 → backfill → 监控旧格式归零 → 切读 → 最后收紧 validator。不要假设“Mongo 不需要 migration”。

### 2.3 建模的单位是 aggregate

文档应围绕一次业务操作需要保持一致、经常一起读取的数据形成 aggregate。决定 embedding/reference 时问四个维度：

| 维度 | 更倾向 embedding | 更倾向 reference |
| --- | --- | --- |
| 读取 | 总与父对象一起读 | 常独立读取或从多入口读取 |
| 一致性 | 需要一次原子写 | 可独立更新、独立生命周期 |
| 基数/增长 | 数量有限、有上界 | 很多、无界或持续增长 |
| 共享 | 仅属于一个父对象 | 被多个实体共享、many-to-many |

例如猫咪品种的固定 5 个评分可以嵌入品种文档；每个用户不断新增的聊天消息不宜无限塞入一个用户文档。后者会导致 16 MiB 风险、每次更新触碰同一热点文档、索引膨胀和分页困难。

### 2.4 一对一、一对多、多对多

- **一对一**：总是一起读取、同生命周期时嵌入；体积大或访问权限/更新频率明显不同时拆分。
- **一对少量**：小而有界的数组适合嵌入，如固定维度评分。
- **一对很多**：子项独立 collection，通过 parentId 引用；父文档可保存有限摘要或最近 N 条。
- **多对多**：通常引用 ID；极高频读取可有意识冗余部分快照，但要定义更新传播与容忍旧值。
- **树/图**：可存 parent reference、ancestors/materialized path 等，取决于读整棵子树、祖先链还是频繁移动节点。

冗余不是错误，它是用写复杂度换读取性能。但必须回答：谁是 source of truth、更新失败怎样修复、旧值允许存在多久。

### 2.5 原子更新与热点文档

单文档写入是原子的，因此把需要一起变化的字段放在同一文档能减少事务。例如计数可用 `$inc`，数组可用 `$push`/`$addToSet`，并用条件过滤实现 compare-and-set。

但单文档原子性不代表“全部嵌入最好”。高并发写同一文档会争用；超大文档搬移、复制和网络成本更高；数组索引也可能膨胀。计数器、事件历史和热门内容要评估分桶、append-only event、独立 collection 或异步聚合。

---

## 3. MongoDB 查询与索引

### 3.1 索引为什么既加速又昂贵

每个索引都需要占磁盘/内存，并在 insert/update/delete 时维护。索引越多写放大越明显，工作集放不进内存后延迟会上升。正确流程是：由真实查询形状驱动索引，用 profiler/slow query 和 `explain()` 验证，定期检查未使用与重复前缀索引。

### 3.2 Compound index 与前缀规则

索引 `{ status: 1, createdAt: -1, score: 1 }` 能有效支持从左开始的前缀，如 `status`，或 `status + createdAt`。跳过首字段直接查 `createdAt` 通常不能高效利用该索引进行定向查找。

常用 ESR 思路：

1. **Equality** 字段优先，快速缩小范围。
2. **Sort** 字段接着放，让索引直接提供顺序。
3. **Range** 字段通常靠后，因为进入范围扫描后，后续字段利用能力下降。

这不是死公式。若 range 极具选择性、sort 数据量很小，可能 ERS 更好。最终看查询分布和 explain，而不是背字母。

还要考虑：

- 索引方向对单字段可双向扫描；复合排序的相对方向更关键。
- 返回字段都能从索引获得时可能成为 covered query，减少 FETCH 文档。
- 低选择性布尔字段单独建索引通常收益有限，partial index 可能更好。
- 大量 `skip` 分页会扫描并丢弃前面的结果；使用稳定排序键 + `_id` 做 seek/cursor pagination。

### 3.3 Multikey index

数组字段建索引后成为 multikey，一个文档可产生多个 index keys。它让数组元素查询高效，但有重要限制：

- compound multikey index 中，每个文档不能让多个被索引字段同时都是数组。
- 数组查询的边界合并依赖 `$elemMatch`；不使用时可能把不同数组元素错误地组合成条件语义或扫描更多键。
- 一些场景难以成为 covered query，特别是投影包含数组本身。
- 超大数组会生成大量键，导致索引与写成本爆炸。

### 3.4 其他索引类型

- **Unique**：保证键唯一，但要明确 null/缺失与复合唯一语义。
- **Partial**：只索引满足表达式的文档，适合 `deletedAt` 不存在、active 状态等子集；查询必须能推导出过滤条件才能使用。
- **Sparse**：跳过缺失字段，表达能力通常不如 partial；与 unique 组合时要理解缺失值。
- **TTL**：按日期字段异步清理过期文档，删除不是精确到秒，不能替代业务关键的同步过期判断。
- **Text**：内建词法全文索引；语言、排序和功能边界与专用搜索引擎不同。
- **Hashed**：常用于 hashed sharding，利于分布递增键写入，但不支持高效范围查询。
- **Wildcard**：字段动态且查询面广时提供兜底，但通常不如面向关键查询设计的精确索引。
- **Geospatial**：`2dsphere` 等支持地理查询，数据格式和查询操作有严格要求。

### 3.5 `explain()` 看什么

至少观察：

- `winningPlan` 是 `IXSCAN` 还是 `COLLSCAN`，是否又有 `FETCH`、`SORT`。
- `nReturned` 与 `totalDocsExamined`、`totalKeysExamined` 的比例。
- 是否出现内存排序、执行时间、被拒绝计划。
- limit 是否被提前利用，索引是否同时满足 filter 与 sort。

不能看到 COLLSCAN 就一律判错：集合很小、查询返回大部分数据时，顺序扫描可能比随机索引读取更合算。验证要基于生产级数据量和分布。

---

## 4. MongoDB Aggregation Pipeline

### 4.1 执行模型

Pipeline 让文档依次经过 stages。除了 `$out`/`$merge`，普通聚合不会修改原 collection。常见顺序是尽早 `$match`、减少字段/数据量，再做昂贵的 unwind、lookup、group、sort；优化器也可能自动拆分/下推部分条件。

示例：统计各品种近 30 天被收藏次数：

```javascript
db.favorites.aggregate([
  { $match: { createdAt: { $gte: startDate } } },
  { $group: { _id: '$breedId', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 20 },
])
```

首个 `$match` 应有 `createdAt` 索引支持，但后续 `$group` 产生的新字段通常不能沿用原 collection 索引完成排序。

### 4.2 关键 stage 的风险

- **`$unwind`**：一个数组展开成多条，基数会相乘；先过滤数组或避免无界数组。
- **`$lookup`**：不是“Mongo 禁止 join”，而是跨 collection join 成本需验证。确保 foreign key 侧有索引，尽量缩小输入，避免相关子查询对大量文档重复执行。
- **`$group`**：可能保存大量分组状态；高基数和大 accumulator 会占内存。
- **`$sort`**：前面没有匹配索引顺序时可能成为阻塞 stage；尽早 limit 有机会减少成本。
- **`$facet`**：同一输入同时运行多个子 pipeline，方便分页+统计，但每个分支都有成本，且受内存限制。
- **`$setWindowFields`**：可做排名、移动统计等，注意 partition/sort 与内存。
- **`$merge`/`$out`**：会写数据，要考虑幂等、唯一键、权限和读写影响。

### 4.3 优化方法

1. 使用 `explain('executionStats')`，不要只看 pipeline 文本。
2. 尽早减少文档数和字段，但也理解 optimizer 可能自动做 projection pruning。
3. 给能发生在 collection scan 阶段的 `$match + $sort` 设计 compound index。
4. 控制 `$lookup` 输入基数并给连接字段建索引。
5. 频繁昂贵统计可预聚合或物化，定义增量更新和修复机制。
6. `allowDiskUse` 能避免部分内存失败，但磁盘 spill 不是性能优化结论，应继续观察延迟和 I/O。

---

## 5. MongoDB 一致性、副本集与分片

### 5.1 单文档原子性与事务

MongoDB 单文档写入原子，多字段条件更新可在一个操作中完成。跨文档、跨 collection 或跨 shard 的多文档事务也受支持，但有额外锁、快照、网络与资源成本，并且长事务会给 oplog、缓存和冲突管理带来压力。

选择顺序：

1. 先看 aggregate 是否能让业务不变量落在单文档。
2. 无法合理建模且必须强一致时使用事务。
3. 跨服务长流程使用 outbox、幂等键、补偿或 saga，而不是把数据库事务保持到外部 API 完成。

事务代码必须处理 transient error、重试和 unknown commit result；重试要求业务写入幂等。

### 5.2 三组经常混淆的配置

| 概念 | 控制问题 | 典型选择 |
| --- | --- | --- |
| Read preference | 从哪个成员读 | primary、primaryPreferred、secondary 等 |
| Read concern | 读到何种可见性/持久性保证 | local、majority、snapshot、linearizable 等 |
| Write concern | 写成功需要多少成员确认/是否等 journal | `w: 1`、`w: 'majority'`、`j`、timeout |

从 secondary 读不自动等于“更高可用且没有代价”：可能读到旧数据，事务和 causal consistency 也有限制。`majority` 不是跨地域零延迟；保证越强，通常等待越多。配置应由数据丢失容忍度、读后写一致性和延迟 SLA 决定。

### 5.3 Replica Set

副本集通常由 primary、secondaries 和可选 arbiter 组成：

```text
Client → Primary 接受写入 → oplog → Secondaries 异步复制
                    ↓ primary 不可用
              成员心跳 + election → 新 Primary
```

- election 期间短暂无法写入，驱动通过 server selection 和 retryable writes 恢复。
- replication lag 会让 secondary read 看到旧值。
- oplog 是有限大小的 capped collection；落后成员若错过窗口可能需要 initial sync。
- majority write concern 能提高故障后的持久性，但应用仍需处理网络超时下“写可能成功但客户端没收到确认”。
- arbiter 只投票不存数据，不应把它当数据冗余。

### 5.4 Sharding 架构

```text
Application
    ↓
mongos query router
    ├─ config server replica set：集群元数据
    ├─ shard A replica set：chunks
    └─ shard B replica set：chunks
               ↕ balancer 迁移数据范围
```

不应因为 MongoDB “能分片”就一开始分片。只要数据和负载能由一个副本集承担，未分片架构更简单。分片通常在容量、写吞吐、工作集或地域需求有证据时引入。

### 5.5 Shard key 是长期架构决策

理想 shard key 要兼顾：

- **分布**：高基数且值分布均匀，避免一个 shard 过热。
- **查询定向**：常见查询包含 shard key，让 mongos 只访问相关 shard。
- **写入扩散**：纯递增 key 的 range sharding 容易把新写集中到最后 chunk。
- **业务语义**：支持需要共置的数据与事务边界。

Range sharding 保留范围局部性，但单调键可能热点；hashed sharding 更均匀，却让范围查询散开。查询不含 shard key 时可能 broadcast/scatter-gather，延迟和资源随 shard 数增长。balancer 能迁移 chunks，但无法拯救低基数或严重倾斜的根本设计。

---

## 6. PostgreSQL 建模与约束

### 6.1 关系模型的优势不只是 JOIN

PostgreSQL 可在数据库层表达：

- `PRIMARY KEY` / `UNIQUE`：实体和候选键。
- `FOREIGN KEY`：引用完整性和删除/更新策略。
- `NOT NULL` / `CHECK`：字段与跨字段局部规则。
- transaction：多个 row/table 作为一个原子提交。
- view/materialized view：稳定读模型与预计算。

应用校验提升用户体验，数据库约束保证所有写入口都遵守不变量。两者不是重复，而是不同信任边界。

### 6.2 Normalization 与有意识的反规范化

- 1NF 关注原子值/关系表达；2NF/3NF 减少部分依赖和传递依赖。
- 规范化减少更新异常，让 source of truth 清晰；代价可能是读取 join 增多。
- 反规范化应有明确读取收益、同步方案和修复手段，而不是“为了性能”提前复制所有字段。
- PostgreSQL JSONB 允许在关系结构中保存变化频繁或不适合拆列的属性，但 ID、唯一键、过滤/排序高频字段和关系通常仍应建正式列。

本项目的猫咪品种固定字段适合列；`appearance`、`personality` 等对象若结构稳定且常被过滤，也应考虑规范化列/子表；若只作为整体展示、结构会演进，JSONB 可以降低迁移成本。

### 6.3 SQL 必会能力

对 5 年经验工程师，至少要熟练：

- INNER/LEFT JOIN 的基数和 null 语义。
- GROUP BY、HAVING 与聚合。
- CTE 的可读性与物化行为不要凭旧版本经验推断。
- Window Function：`row_number`、`rank`、running total、partition。
- correlated subquery 与 lateral join 的适用场景。
- keyset pagination，而不是大 offset。
- `INSERT ... ON CONFLICT` 的 upsert 语义与竞态处理。

SQL 的第一步是先写对结果基数。`users JOIN orders JOIN items` 会产生乘法行数，聚合前要知道一行代表什么。

---

## 7. PostgreSQL MVCC、事务与锁

### 7.1 MVCC 的直觉

PostgreSQL 更新通常创建新 tuple version，旧版本在仍有 transaction snapshot 需要时保留。读者可以看到符合自己 snapshot 的版本，避免大多数读写互相阻塞。

代价是：死版本要由 VACUUM 回收可复用空间，统计信息要更新，长期事务会阻碍清理并造成 bloat。MVCC 不是“完全没有锁”，DDL、行更新、唯一检查和显式锁仍会阻塞。

### 7.2 隔离级别

| Level | PostgreSQL 关键语义 | 可能问题/处理 |
| --- | --- | --- |
| Read Committed | 每条语句看到语句开始前已提交数据；默认 | 同一事务两次查询结果可能变化 |
| Repeatable Read | 事务内稳定 snapshot；PG 还防止标准中的 phantom read | 并发写可能导致 serialization-like failure，需重试 |
| Serializable | 模拟串行执行结果 | 可能 serialization failure，应用必须整体重试事务 |

PostgreSQL 的 Read Uncommitted 实际按 Read Committed 处理。不要只背 ANSI 表，要说明具体数据库实现。

### 7.3 Lost update、悲观锁和乐观锁

库存/计数等并发更新可选：

- 原子 SQL：`UPDATE ... SET count = count + 1`，最简单。
- 条件更新：`... WHERE version = :old_version`，受影响行数为 0 表示冲突，属于 optimistic concurrency。
- `SELECT ... FOR UPDATE`：先锁定行再计算，属于 pessimistic locking，事务必须短。
- 更高隔离级别：让数据库检测异常，应用处理重试。

先定义不变量，再选机制。读出值、在应用 `+1`、无条件写回是典型 lost update 风险。

### 7.4 Deadlock

两个事务按相反顺序持锁可能死锁。PostgreSQL 会检测并中止其中一个，应用要重试。预防方法：

- 所有代码按稳定顺序锁资源。
- 缩短事务，不在事务内调用 LLM/HTTP。
- 为查询建立合适索引，减少锁住/扫描的行。
- 监控 blocked query、lock wait 和 deadlock 日志。
- 设置合理的 statement/lock timeout，但 timeout 不是修复根因。

### 7.5 VACUUM 与 autovacuum

VACUUM 主要回收死 tuple 供复用、维护 visibility map，并防止 transaction ID wraparound；ANALYZE 更新 planner statistics。普通 VACUUM 通常不会把文件立即缩小交还操作系统，`VACUUM FULL` 会重写表并需要更强锁，不能当日常操作。

高更新表需要观察 dead tuples、autovacuum 频率、长事务和表/索引 bloat，按表调整阈值，而不是简单关闭 autovacuum。

---

## 8. PostgreSQL 索引与执行计划

### 8.1 索引类型

| 索引 | 典型用途 | 关键点 |
| --- | --- | --- |
| B-tree | `=`, range, sort, prefix | 默认选择；复合索引前导列与排序方向重要 |
| Hash | equality | 使用范围窄，B-tree 往往已满足 |
| GIN | JSONB、array、全文 token | 读过滤强，更新成本和索引体积较高 |
| GiST | range、几何、近邻等扩展 | 通用搜索树，行为取决于 operator class |
| BRIN | 超大且物理顺序与值强相关的表 | 索引极小、返回 block range，适合时间追加表 |
| pgvector HNSW/IVFFlat | ANN 向量近邻 | 精度/构建/查询/内存取舍，需实测 recall |

还要掌握：

- **Multicolumn**：从查询 filter/sort 设计，而不是每列都放进去。
- **INCLUDE**：非 key 列可帮助 index-only scan，但增加索引体积。
- **Partial**：只索引活跃行等常查子集，查询谓词必须与其条件匹配。
- **Expression**：如 `lower(email)`；查询表达式必须一致。
- **Unique**：既是性能结构，也是并发安全的数据约束。

### 8.2 JSONB 索引

JSONB 可用 GIN：默认 `jsonb_ops` 支持较多操作；`jsonb_path_ops` 支持面更窄，但对 containment 等操作可能更小、更快。某个固定路径高频查询时，expression index 可能比整个 JSONB GIN 更精准。

例：若经常查 `traits->>'energy_level'`，应考虑把它升为正式列，或建 expression index。不要为一个几乎不查询的大 JSONB 盲目建 GIN。

### 8.3 为什么索引没有被使用

可能原因包括：

- 表很小或查询返回很大比例，sequential scan 更便宜。
- 统计信息过旧或数据分布相关性估计不准。
- 查询对列做函数/隐式类型转换，与索引表达式不匹配。
- 复合索引前导列不符合查询。
- 排序、limit、random I/O cost 和缓存状态让另一计划更便宜。
- 参数化 prepared statement 选择 generic plan，不能利用具体值分布。

不要用 `enable_seqscan = off` 当生产修复。先用执行计划和真实参数找原因。

### 8.4 阅读 `EXPLAIN (ANALYZE, BUFFERS)`

`EXPLAIN ANALYZE` 会真实执行语句，写操作要在可回滚环境谨慎使用。阅读顺序：

1. 从最内层节点看数据如何产生。
2. 对比 estimated rows 与 actual rows，数量级差异说明统计/相关性问题。
3. 看 loops；一个不贵的 inner node 执行几十万次也会很贵。
4. 看 actual time、排序方式、内存/磁盘 spill。
5. 看 shared hit/read/dirtied/written buffers，区分 CPU 与 I/O。
6. 检查 Filter 删除多少行、join 算法和索引条件。

优化后要在相近数据分布、冷/热缓存和并发条件下复测，单次本地 2ms 不能代表生产 p95。

---

## 9. SQLModel、Session 与迁移

### 9.1 Engine、Pool、Session、Transaction

```text
Engine：数据库方言 + 连接池入口
Connection：池中的真实数据库连接
Session：ORM Unit of Work / identity map / flush 边界
Transaction：数据库原子提交与隔离边界
```

Session 不等于连接，但在执行时会借连接；它不是跨请求线程安全的全局单例。本项目用 FastAPI `Depends(get_session)` 为请求创建/释放 Session，这与 NestJS request-scoped resource 的目的相近。

必须区分：

- `add()`：让对象进入 Session 管理。
- `flush()`：把 SQL 发给数据库但不提交，可获得数据库生成值。
- `commit()`：提交事务。
- `refresh()`：从数据库重新加载对象。
- `rollback()`：失败后回滚，Session 才能安全继续使用/关闭。

### 9.2 当前项目的并发问题

本项目使用同步 SQLModel Session，而部分路由/服务是 `async def`。同步数据库查询和本地同步 embedding 如果直接在事件循环执行，会阻塞同一 worker 上其他连接。

可选演进：

- 保持同步调用链，让 FastAPI 在线程池运行同步 route；适合规模较小且依赖均同步。
- 使用 SQLAlchemy AsyncSession + async driver，并确保 repository 全链异步。
- 暂时 `asyncio.to_thread` 隔离明确的同步热点，但设置容量和超时。
- CPU 密集 embedding 放独立进程/worker 或专用推理服务。

不要只把函数改成 `async def`；没有非阻塞驱动时不会自动异步。

### 9.3 Migration

开发原型可 `create_all()`，生产必须用版本化 migration（如 Alembic）：

- schema change 与应用发布兼容，采用 expand/contract。
- 大表加 NOT NULL/default/index 要评估锁、重写与并发写。
- `CREATE INDEX CONCURRENTLY` 降低写阻塞，但有自己的事务限制与失败清理。
- backfill 分批、可重试、有进度和校验。
- 备份只在验证过 restore 后才可信。

---

## 10. PostgreSQL、MongoDB、JSONB 与向量选型

### 10.1 PostgreSQL vs MongoDB

| 维度 | PostgreSQL 更强的场景 | MongoDB 更强的场景 |
| --- | --- | --- |
| 数据关系 | 强约束、复杂 join、跨实体事务 | aggregate 自包含、一次读取完整文档 |
| Schema | 数据库强制约束、统一治理 | 多形态文档、字段快速演进 |
| 查询 | SQL、窗口函数、ad hoc 分析 | 文档路径查询、pipeline、天然嵌套返回 |
| 扩展 | scale-up/读副本/分区，扩展生态成熟 | 内建 sharding 与文档路由模型 |
| 写一致性 | 多表 ACID 是核心能力 | 单文档原子简洁，多文档事务可用但应谨慎 |
| 团队成本 | 需关系建模、SQL/planner 能力 | 需访问模式建模、冗余一致性和 shard key 能力 |

两者都能存 JSON、建索引、做事务和扩展，选型应讨论默认路径与团队运营成本，而不是列“能/不能”。

### 10.2 PostgreSQL JSONB vs MongoDB document

选择 JSONB 的理由：业务主数据已经在 PostgreSQL，需要和关系表事务一致；只有部分属性半结构化；查询规模与吞吐在单一 PostgreSQL 内可控。

选择 MongoDB 的理由：大部分实体天然是自包含文档，嵌套结构变化频繁，以 aggregate 为单位读写；团队已有副本集/分片运营能力，并且实际负载证明关系 join/约束不是核心。

反例：把整个系统塞进一列 JSONB 会失去很多约束和可读 SQL；把强关系数据迁到 Mongo 再在应用手写 join/foreign key，也可能只是转移复杂度。

### 10.3 本项目为什么选 PostgreSQL + pgvector

当前项目只有少量猫咪知识文档，业务数据已经使用 PostgreSQL：

- pgvector 复用连接、事务、备份、权限和运维体系。
- 关系数据、JSONB 属性和 512 维 embedding 可在一次查询中组合 filter。
- 数据量很小时精确扫描足够，没必要增加独立 Milvus 集群。
- 未来先以真实 QPS、p95、Recall@K、索引构建时间和内存验证 HNSW/IVFFlat，再决定迁移。

MongoDB 也有向量检索能力，但不能因为曾经用过 Mongo 就引入第二个主数据库。选型要看现有数据边界和运营成本。

### 10.4 pgvector vs Milvus 的触发式决策

| 问题 | 当前答案 | 重新评估信号 |
| --- | --- | --- |
| 向量规模 | 18 篇，极小 | 千万/亿级或增长速度显著 |
| 查询并发 | 原型流量 | 独立向量 QPS 影响 OLTP |
| 过滤/事务 | 与业务数据共库有价值 | 向量服务生命周期独立 |
| 运维 | 一个 PostgreSQL | 团队已有 Milvus/K8s 运维能力 |
| 性能证据 | 精确搜索足够 | 调优 pgvector 后仍不能达成 recall/latency SLA |

这比“pgvector 简单，Milvus 专业”更有说服力，因为它给出了退出条件。

---

## 11. 用本项目做数据建模练习

### 11.1 猫咪品种

关系模型可拆为：

```text
cat_breeds(id, slug, name, origin, description, image_url, ...)
cat_traits(breed_id, trait_key, score)
cat_aliases(breed_id, locale, alias)
```

若 trait 固定为五维且总是一起读取，可直接五列或受约束 JSONB；若维度由后台动态扩展，子表更灵活。选择依据是过滤/排序、约束和演进，不是“JSONB 少建表”。

MongoDB 版本可把固定 traits 与少量 aliases 嵌入 breed document，因为它们有界、同生命周期、总是一起读。用户收藏应独立 collection，因为按用户持续增长且需要独立分页/唯一约束。

### 11.2 AI 会话

错误设计：一个 user document 内无限 `$push` 所有 messages。

更稳妥：

```text
conversations: { _id, userId, title, lastMessageAt, summary, ... }
messages:      { _id, conversationId, role, content, createdAt, ... }
```

MongoDB 给 `messages` 建 `{ conversationId: 1, createdAt: -1, _id: -1 }` 支持游标分页；PostgreSQL 建相同逻辑复合 B-tree 与 FK。会话摘要可冗余，后台异步更新；消息正文作为 source of truth。

### 11.3 RAG 知识文档

建议字段：document/chunk ID、source、title、content、metadata、embedding model/version、dimension、content hash、updated_at。

关键不变量：embedding model 与 vector dimension 必须匹配；content/model 改变要重算；删除/更新文档要同步索引；检索结果需能回到 source 做引用。不能只存 vector 而失去版本与来源。

---

## 12. 高频面试题与参考回答

### Q1：MongoDB 没有 Schema 吗？

它是 Schema-flexible，不是没有 Schema。结构约束可来自 collection validator 和应用模型；生产系统仍需版本、迁移、兼容和数据质量治理。

### Q2：什么时候 embed，什么时候 reference？

经常一起读、同生命周期、数量有界、需要单文档原子时 embed；独立读取/更新、被共享、many-to-many 或无界增长时 reference。

### Q3：MongoDB 为什么强调访问模式建模？

文档边界决定一次读取和单文档原子边界。先照关系表拆 collection 再大量 `$lookup`，或把全部内容塞一个文档，都没有利用文档模型优势。

### Q4：单文档原子是否意味着不需要事务？

不是。跨文档不变量仍可能需要事务；但先优化 aggregate 边界，避免把可以单文档完成的操作不必要地变成多文档事务。

### Q5：Compound index 顺序怎么定？

从真实 filter/sort/range 形状出发，ESR 是常用起点，再以选择性、分页和 explain 验证。不能只按字段基数排序，也不能给所有排列都建索引。

### Q6：什么是 multikey index？

数组字段的每个元素产生索引键。它支持数组查询，但索引体积、compound 多数组限制、`$elemMatch` 语义和 covered query 都需注意。

### Q7：TTL index 能保证准时删除吗？

不能。后台任务周期性删除，存在延迟。授权/token 过期判断必须在读取或业务逻辑中实时检查，TTL 负责最终清理。

### Q8：为什么分页不用大量 skip？

skip 仍需扫描并丢弃前面记录，页数越深越慢，而且并发插入会造成重复/漏项。用稳定排序字段加唯一 `_id` 做 keyset pagination。

### Q9：`$lookup` 一定很慢吗？

不一定。输入小、连接字段有索引、pipeline 能过滤时可以合理使用。要看基数和 executionStats，而不是因为 Mongo 是 NoSQL 就禁止 join。

### Q10：read preference 与 read concern？

前者决定去哪个成员读，后者决定读到的可见性保证。secondary read 可能降低 primary 读负载，但会引入 replication lag 语义。

### Q11：`w: majority` 是否保证绝不丢数据？

它要求多数投票成员确认，提高故障持久性，但客户端超时仍可能不知道写是否已提交，配置、拓扑和 journal 也影响语义；应用仍需幂等和结果确认。

### Q12：Shard key 选错有什么后果？

低基数或单调 range key 可能造成热点；查询不含 shard key 会 scatter-gather；迁移和均衡成本增加。需要同时看分布、写入与查询定向。

### Q13：PostgreSQL MVCC 是什么？

写入产生 tuple version，查询按 snapshot 看可见版本，使普通读写少阻塞。旧版本由 VACUUM 回收，长事务会阻止清理并造成 bloat。

### Q14：Read Committed 下同一事务两次 SELECT 一样吗？

不保证。PostgreSQL 默认每条语句获得新 snapshot，期间其他已提交事务可能让第二次结果不同。

### Q15：Repeatable Read 会发生 phantom 吗？

按 PostgreSQL 实现，它提供稳定 snapshot，并防止标准所说的 phantom read；但并发更新可能让事务失败，仍需重试。

### Q16：什么时候 `SELECT FOR UPDATE`？

必须基于当前行状态执行后续写且冲突概率较高时。事务要短并保持锁顺序；简单计数优先原子 UPDATE，低冲突也可用 version 乐观锁。

### Q17：为什么会 deadlock？

多个事务按不同顺序等待彼此持有的锁。数据库会终止一个；应用重试，同时通过统一锁顺序、短事务和合适索引降低发生率。

### Q18：VACUUM 会缩小数据文件吗？

普通 VACUUM 主要把空间标为可复用，通常不把文件归还 OS。`VACUUM FULL` 会重写并加重锁，不是日常清理方案。

### Q19：为什么索引没被使用？

planner 认为顺扫成本更低，或统计错误、选择性低、表达式/类型不匹配、复合索引顺序不对。用实际计划、rows 和 buffers 验证，而不是强制禁用顺扫。

### Q20：GIN 与 B-tree 怎么选？

B-tree 适合标量 equality/range/sort；GIN 适合一个值包含多个 searchable keys，如 JSONB、array、全文。GIN 更新与体积成本更高。

### Q21：JSONB 为什么不替代所有关系表？

它对半结构属性很有用，但跨文档 FK、类型约束、常用过滤排序、join 和演进可读性不如正式列/表。核心关系仍应关系化。

### Q22：Session 是数据库连接吗？

不完全是。ORM Session 是 Unit of Work/identity map，需要执行时从 Engine pool 借连接。它应按请求/事务使用并正确 rollback/close。

### Q23：`flush` 和 `commit`？

flush 将 pending SQL 发往数据库，事务仍未提交，可读取生成值；commit 使事务提交并对其他事务按隔离规则可见。

### Q24：为什么 async route 里同步 SQL 有问题？

同步驱动会阻塞事件循环线程，拖慢同 worker 的其他请求。应改全链异步、把同步 route 交线程池，或受控地隔离阻塞调用。

### Q25：为什么本项目不用 Milvus？

向量极少且业务已在 PostgreSQL，pgvector 复用事务与运维，精确搜索已够。只有压测证明 pgvector 在规模/并发/独立扩展上无法达成 SLA 才迁移。

---

## 13. Day 6–7 学习安排

### Day 6：MongoDB 深入（5.5 小时）

1. **建模（75 分钟）**：BSON、validator、embedding/reference、基数、无界数组、Schema migration。
2. **索引与查询（75 分钟）**：compound/ESR、multikey、partial/TTL、cursor pagination、explain。
3. **Aggregation（60 分钟）**：手写 `$match → $lookup → $unwind → $group`，估算每阶段基数并调整顺序。
4. **分布式语义（75 分钟）**：事务、read/write concern、read preference、副本集、分片和 shard key。
5. **口述（45 分钟）**：回答 Q1–Q12；为用户会话设计 Mongo 文档与索引。

验收：能独立发现无界数组、热点文档、scatter-gather 和索引写放大，并提出可验证的替代设计。

### Day 7：PostgreSQL、对比与模拟面试（5.5 小时）

1. **关系与 SQL（60 分钟）**：约束、join 基数、window、CTE、keyset pagination、upsert。
2. **事务（60 分钟）**：MVCC、三个隔离级别、锁、deadlock、VACUUM；画 tuple version 可见性。
3. **索引与计划（75 分钟）**：B-tree/GIN/BRIN/partial/expression；阅读两份 `EXPLAIN ANALYZE BUFFERS`。
4. **项目源码（60 分钟）**：追踪 Engine/Session/Repository、JSONB/Vector，找出同步阻塞路径与 migration 缺口。
5. **选型与口述（75 分钟）**：回答 Q13–Q25；完成 PostgreSQL/MongoDB/pgvector/Milvus 的条件式选型；录制 3 分钟数据库深挖。

验收：面对一个业务场景，先写访问模式与不变量，再设计 Schema/索引/事务，并说出用什么指标验证。

---

## 14. 必做实验

1. 为猫咪、用户、收藏、会话、消息分别设计 PostgreSQL 与 MongoDB 模型，并标出 source of truth。
2. 构造 10 万 Mongo 文档，对比无索引、compound index、错误索引顺序的 executionStats。
3. 建含数组字段的数据，验证 multikey、`$elemMatch` 和 compound 多数组限制。
4. 用两条事务复现 PostgreSQL lost update，再分别用原子 UPDATE、version 条件和 `FOR UPDATE` 修复。
5. 制造一个简单 deadlock，观察被中止事务并实现有限次数退避重试。
6. 用 PostgreSQL 建 B-tree、partial、expression、GIN，比较 estimated/actual rows 与 buffers。
7. 为 20 条向量查询记录 pgvector 精确检索与 ANN 的 Recall@K、p95，而不是只记录单次耗时。
8. 设计一次 `cat_breeds` 新增非空字段的 expand/contract migration，不锁表长时间。

---

## 15. 官方资料阅读顺序

### MongoDB

1. [MongoDB：Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
2. [MongoDB：Embedded Data](https://www.mongodb.com/docs/manual/data-modeling/embedding/)
3. [MongoDB：Indexes](https://www.mongodb.com/docs/manual/indexes/)
4. [MongoDB：Compound Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/)
5. [MongoDB：Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
6. [MongoDB：Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/)
7. [MongoDB：Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
8. [MongoDB：Replication](https://www.mongodb.com/docs/manual/replication/)
9. [MongoDB：Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/)
10. [MongoDB：Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/)
11. [MongoDB：Read Preference](https://www.mongodb.com/docs/manual/core/read-preference/)
12. [MongoDB：Sharding](https://www.mongodb.com/docs/manual/sharding/)

### PostgreSQL 与向量

1. [PostgreSQL：Indexes](https://www.postgresql.org/docs/current/indexes.html)
2. [PostgreSQL：Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
3. [PostgreSQL：Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
4. [PostgreSQL：Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
5. [PostgreSQL：Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)
6. [PostgreSQL：JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)
7. [PostgreSQL：GIN](https://www.postgresql.org/docs/current/gin.html)
8. [SQLModel：Session with Dependency](https://sqlmodel.tiangolo.com/tutorial/fastapi/session-with-dependency/)
9. [pgvector](https://github.com/pgvector/pgvector)
10. [pgvector-python](https://github.com/pgvector/pgvector-python)
11. [Milvus Architecture](https://milvus.io/docs/architecture_overview.md)

---

## 16. 最终自测清单

- [ ] 我能解释 BSON 类型、缺失/null 和 16 MiB 限制。
- [ ] 我能按访问模式选择 embedding/reference，并识别无界增长。
- [ ] 我能设计 compound/multikey/partial/TTL 索引并阅读 explain。
- [ ] 我能估算 Aggregation 每个 stage 的基数变化。
- [ ] 我能区分 read preference、read concern、write concern。
- [ ] 我能画出副本集选主与分片查询路由。
- [ ] 我能说明 hashed/range shard key 的取舍和 scatter-gather。
- [ ] 我能解释 PostgreSQL MVCC、隔离级别、锁与 VACUUM。
- [ ] 我能使用约束保护不变量，而不只依赖 ORM 校验。
- [ ] 我能按查询选择 B-tree、GIN、BRIN、partial 和 expression index。
- [ ] 我能阅读 `EXPLAIN (ANALYZE, BUFFERS)` 的 estimates、actual、loops 和 I/O。
- [ ] 我能区分 Engine、Connection、Session、Transaction、flush 和 commit。
- [ ] 我能说明同步 SQLModel 在 async 路径中的问题。
- [ ] 我能从关系、文档、JSONB 与向量负载比较 PostgreSQL/MongoDB/Milvus。
- [ ] 我能用条件与指标说明何时维持当前选型、何时迁移。
