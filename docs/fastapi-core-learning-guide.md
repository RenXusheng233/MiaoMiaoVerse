# FastAPI 核心知识与递进实战

> 面向有前端/NestJS 经验、正在学习 Python，但还不能独立理解和编写 FastAPI 接口的开发者。
>
> 本文是入门练习册，不是知识点大全。只深入六件事：路由、输入校验、响应异常、依赖注入、异步、数据库生命周期。先不引入 LangChain、RAG、鉴权系统或复杂分层。
>
> 示例验证基准：Python 3.14.6、FastAPI 0.140.7、Starlette 1.3.1、Pydantic 2.13.4、SQLModel 0.0.39、HTTPX 0.28.1。项目说明中的 FastAPI 0.139 是声明信息，这里记录的是本地实际安装版本。核对日期：2026-08-27。

## 阅读路线：先看懂一小段，不要求立即从零写

你的第一轮学习目标不是 review 整个后端，而是能回答：“这个参数从哪里来？这行代码由谁执行？执行后能观察到什么？”

每节按下面顺序学习：

1. 复制完整示例并运行，不急着重写。
2. 发请求，对照返回值和终端日志。
3. 看解释，只改练习要求的一处。
4. 先预测结果再运行；预测错了就回看对应概念。
5. 能解释后，再读本项目对应的几行源码。

前五节是同一个“猫咪接口”主题下的独立小实验，第六节把概念合成 CRUD。**各节分别保存，不要把全部代码拼进一个文件。** 小例子暂时省略完整响应模型或分层时，会明确说明；它们不是生产模板。

建议先做 1–3 节，再做 4–5 节，最后做第 6 节。每次 45–90 分钟即可，完成一节的验收比按时翻完更重要。

### 练习环境：不要覆盖项目的 backend/main.py

在一个独立的练习目录中创建环境；以下命令是供你手动练习使用，不会由本文自动执行：

```bash
uv init fastapi-study --bare --python 3.14
cd fastapi-study
uv add "fastapi[standard]==0.140.7" "starlette==1.3.1" "pydantic==2.13.4" "sqlmodel==0.0.39" "httpx==0.28.1"
```

固定版本是为了复现教学实验，不是生产升级建议。安装可能需要下载 Python/依赖；不必为了学习修改原项目的 lockfile 或虚拟环境。

将各节的完整代码分别保存为 `lesson01.py`、`lesson02.py` 等。启动第一节：

```bash
uv run uvicorn lesson01:app --reload --port 8010
```

浏览器打开 `http://127.0.0.1:8010/docs`。点击接口 → Try it out → Execute，可以直接发请求，不需要先写前端。

切换章节时先按 Ctrl+C 停掉上一节，再把命令中的 `lesson01` 换成对应文件名。端口使用 8010，避免与项目的 8000 冲突。

后文 `curl` 的单引号写法适用于你的 macOS/zsh。`curl -i` 会同时显示 HTTP 状态和响应头；代码块中的 Python 注释用英文，解释在正文中。

---

## 1. 最小应用：到底是谁调用了我的函数？

### 1.1 完整示例

保存为 `lesson01.py`：

```python
# file: lesson01.py
from fastapi import FastAPI

print("module loaded")
app = FastAPI(title="Cat Study API")


@app.get("/cats/{cat_id}")
def get_cat(cat_id: int):
    print("handler called", cat_id, type(cat_id).__name__)
    return {"id": cat_id, "name": "Mimi"}
```

请求：

```bash
curl -i http://127.0.0.1:8010/cats/1
curl -i http://127.0.0.1:8010/cats/abc
```

第一条返回 200 和 `{"id":1,"name":"Mimi"}`，终端输出 `handler called 1 int`。第二条返回 422，**不会进入 get_cat 的函数体**，因此不会打印对应 handler 日志。

### 1.2 逐段理解

- `from fastapi import FastAPI`：导入框架提供的应用类，不是启动服务器。
- `app = FastAPI(...)`：创建应用对象，里面维护路由、中间件等配置。
- `@app.get(...)`：模块加载时，把路径、HTTP 方法与函数登记到路由表；不是此刻就执行函数体。
- `def get_cat(cat_id: int)`：定义处理函数。HTTP 请求到达时，FastAPI 解析参数，再调用它。
- `return {...}`：返回 Python dict。普通 JSON 响应路径下，框架负责把它编码成 HTTP JSON 响应。

`uvicorn lesson01:app` 的意思是：导入 `lesson01` 模块，取出变量 `app`，由 Uvicorn 监听端口并驱动这个 ASGI 应用。ASGI 是服务器和异步 Python Web 应用的接口规范；暂时不需要手写 ASGI 协议。

```text
启动：Uvicorn → 导入模块 → 创建 app → 注册路由
请求：GET /cats/1 → 匹配路由 → 把 "1" 解析成 int → get_cat(1) → JSON 响应
```

`module loaded` 在模块导入时打印；`handler called` 是每次合法请求才打印。开发模式热重载会重新导入，多进程也各有自己的导入，不要理解成“整个部署永远只执行一次”。

### 1.3 和 NestJS 的联系，以及一个重要区别

可先把 `@app.get` 理解为登记 Controller method 的工作。但 FastAPI 允许直接登记普通函数，不要求先有 Controller class 或 Module。

Python 的 `cat_id: int` 本身不会在所有地方强制校验。HTTP 请求经过 FastAPI 才会执行这一套参数解析；你在 Python 中直接调用 `get_cat("abc")`，普通函数不会自动把字符串拒绝掉。不要把“函数类型注解”和“框架执行的运行时校验”混为一谈。

### 1.4 只改一处

把 `cat_id: int` 改成 `cat_id: str`，再请求 `/cats/abc`。

**先预测，再看答案：** 现在返回 200，因为字符串符合新的声明。类型注解不仅影响编辑器提示，也影响 FastAPI 构建出来的 HTTP 参数契约。

**验收：** 能说出启动阶段与请求阶段的区别，能解释第二条请求为什么没有进入 handler。

回到项目：只看 `backend/main.py` 的 `app = FastAPI(...)` 和最后的 `@app.get("/")`。暂时忽略其他 import。

资料：[FastAPI First Steps](https://fastapi.tiangolo.com/tutorial/first-steps/)、[Path Parameters](https://fastapi.tiangolo.com/tutorial/path-params/)。

---

## 2. 输入：参数怎么从 HTTP 进入 Python？

### 2.1 先区分输入位置与校验规则

路径里的 ID、URL 后的筛选条件、JSON body 是不同输入位置；“整数、必填、最小长度”是校验规则。FastAPI 把二者都写在函数签名和模型定义里。

保存为 `lesson02.py`：

```python
# file: lesson02.py
from typing import Annotated

from fastapi import FastAPI, Path, Query
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI()


class CatCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=30)
    age: int = Field(ge=0, le=30)
    nickname: str | None = None


@app.post("/cats/{cat_id}/preview")
def preview_cat(
    cat_id: Annotated[int, Path(gt=0)],
    data: CatCreate,
    verbose: bool = False,
):
    return {"id": cat_id, "cat": data.model_dump(), "verbose": verbose}


@app.get("/cats")
def list_cats(
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
    q: str | None = None,
):
    return {"limit": limit, "q": q}
```

这是输入解析实验，`preview` 不保存数据，`list_cats` 也只回显筛选条件。

请求：

```bash
curl -i -X POST 'http://127.0.0.1:8010/cats/1/preview?verbose=true' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mimi","age":2}'
curl -i 'http://127.0.0.1:8010/cats?limit=3&q=Mimi'
```

第一条的响应：

```json
{"id":1,"cat":{"name":"Mimi","age":2,"nickname":null},"verbose":true}
```

### 2.2 把签名翻译成人话

| 声明 | 从哪里取值 | 规则 |
| --- | --- | --- |
| `cat_id: Annotated[int, Path(gt=0)]` | `/cats/{cat_id}/preview` | 转成整数并大于 0 |
| `data: CatCreate` | JSON body | 按 CatCreate 构建并校验模型实例 |
| `verbose: bool = False` | Query | 未提供时是 False |
| `limit: Annotated[int, Query(...)] = 10` | Query | 未提供时 10，提供时必须在 1–20 |

`Annotated[int, Query(...)]` 的直觉是：“Python 类型是 int，同时给框架补充 Query 规则”。它不是一个新的业务类。

在这里，单个 Pydantic body 模型接收的是 `{"name":...,"age":...}`，**不是** `{"data":{"name":...}}`。若要包一层，需另行声明 `Body(embed=True)`；多个 body 参数也会改变请求结构，当前先不展开。

单值参数默认常被理解为 Query，但 Header/Cookie 需要 `Header()`/`Cookie()` 等明确声明。不要以为参数名叫 `token` 就会自动读取 Authorization header。

### 2.3 Pydantic 在这里做了什么？

把 HTTP 请求 body 解析成 Python 数据后，FastAPI 委托 Pydantic 按模型要求处理。进入 handler 时，`data` 已经是 `CatCreate` 实例，可用 `data.name` 读取；`data.model_dump()` 才是转换成 dict。

对照 NestJS：这类似 DTO + ValidationPipe 在运行时处理数据，不等同于只有 TypeScript interface。Python 普通注解也不等于运行时校验；继承 BaseModel 后的模型构建才有 Pydantic 行为。

现在只记住三个方法：

- `CatCreate.model_validate(raw)`：把 Python 数据校验成模型。
- `data.model_dump()`：把模型变成 Python dict。
- `data.model_dump_json()`：把模型变成 JSON 字符串。

普通 API 返回模型或 dict 即可，不要先 `model_dump_json()` 再当普通字符串 return，否则容易得到“JSON 内包含一个 JSON 字符串”的双重编码。

### 2.4 必填、可为 None、默认值是三个概念

下面讨论的是 **Pydantic 模型字段**：

| 字段声明 | 可以省略吗 | 可以传 null 吗 |
| --- | --- | --- |
| `name: str` | 不可以 | 不可以 |
| `name: str = "Mimi"` | 可以，使用默认值 | 不可以 |
| `nickname: str \| None` | 不可以 | 可以 |
| `nickname: str \| None = None` | 可以 | 可以 |

`str | None` 只扩大允许的值范围；`= None` 才提供省略时的默认值。Pydantic v2 中不能把 `Optional` 直接理解为“可以不传”。

### 2.5 错误输入实验

保持 name 为 Mimi，每次只改一项，通过 `/docs` 很容易重复试验：

| 改动 | 预期 | 原因 |
| --- | --- | --- |
| 省略 age | 422 | 必填字段缺失 |
| `age: -1` | 422 | 不满足 ge=0 |
| `age: "2"` | 200，age 变为整数 2 | 默认允许这种类型转换 |
| `age: "two"` | 422 | 不能解析成整数 |
| `name: ""` | 422 | 长度小于 1 |
| 添加 `debug: true` | 422 | 本例明确设置 extra=forbid |
| 路径 ID 为 0 | 422 | 不满足 gt=0 |
| Query `limit=21` | 422 | 不满足 le=20 |

422 的 `detail` 中重点看 `loc`，它会告诉你错误位于 body、path 还是 query，以及哪个字段；具体错误文案可能随版本变化，不建议按整段英文字符串做测试断言。

### 2.6 只改一处

把 age 改为 `Field(ge=0, le=30, strict=True)`，再提交 `"age":"2"`。

**答案：** 现在返回 422，整数 `2` 仍然合法。严格模式针对这个 body 字段禁止了原来的字符串转整数，不是“所有 Query 文本都不能再转型”。

另一个小观察：`min_length=1` 不会阻止全是空格的名字。是否去空格、如何处理 Unicode，属于你还需明确的业务规则；框架不会替你决定。

**验收：** 能根据函数签名写出正确的 URL 与 JSON，并解释为什么“可传 null”和“可省略”不同。

回到项目：看 `backend/schemas/cat_manage.py` 的 Field/Literal，再看 `routers/cats.py` 的 Query。先忽略业务字段数量。

资料：[Request Body](https://fastapi.tiangolo.com/tutorial/body/)、[Query Validation](https://fastapi.tiangolo.com/tutorial/query-params-str-validations/)、[Pydantic Fields](https://docs.pydantic.dev/latest/concepts/fields/)。

---

## 3. 输出：返回值、HTTP 状态和异常分别是谁负责？

### 3.1 完整示例

保存为 `lesson03.py`：

```python
# file: lesson03.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()
cats = {1: {"id": 1, "name": "Mimi", "age": 2, "internal_note": "demo-only"}}


class CatOut(BaseModel):
    id: int
    name: str
    age: int


@app.get("/cats/{cat_id}", response_model=CatOut)
def get_cat(cat_id: int):
    cat = cats.get(cat_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Cat not found")
    return cat


@app.get("/broken", response_model=CatOut)
def broken_response():
    # Deliberately invalid output for this lesson.
    return {"id": 1, "name": "Mimi"}
```

请求：

```bash
curl -i http://127.0.0.1:8010/cats/1
curl -i http://127.0.0.1:8010/cats/999
curl -i http://127.0.0.1:8010/broken
```

结果依次为：200，且没有 `internal_note`；404，body 为 `{"detail":"Cat not found"}`；500，终端记录响应校验异常。

### 3.2 `response_model` 是对服务端输出的约束

读取过程可以这样理解：

```text
内部 dict（有 internal_note）
  → response_model 校验 id/name/age
  → 按输出模型生成公开数据
  → JSON 响应（没有 internal_note）
```

它不仅生成文档，也实际参与输出校验和字段过滤。输入模型回答“客户端允许提交什么”，输出模型回答“客户端允许看到什么”；两者通常不应和数据库表模型完全混用。

但字段过滤不是鉴权。如果用户无权看这只猫的私有数据，需要在业务逻辑或依赖中拒绝请求。直接返回 `Response`/`JSONResponse` 是另一条路径，也不会自动应用同样的模型处理；入门阶段先使用普通 return。

### 3.3 422、404 和 500 的责任边界

| 场景 | 谁发现问题 | 结果 |
| --- | --- | --- |
| `/cats/abc`，但 ID 声明为 int | 框架输入解析 | 422，handler 不执行 |
| `/cats/999`，类型合法但资源不存在 | 你的业务判断 | 404 |
| `/broken`，返回值缺少必需 age | 框架输出校验 | 500，服务端违反了自己声明的契约 |

`raise HTTPException(...)` 是“终止当前流程，交给框架生成错误响应”。它不是普通数据，因此不能写成 `return HTTPException(...)`。

不要用 `except Exception: return {"error":...}` 包住整个接口。这样可能把未知 bug 伪装成 HTTP 200，而且会失去原本的错误分类。预期业务错误明确返回，未知异常交给统一日志与错误边界；生产响应不要暴露 traceback 或 secret。

### 3.4 只改一处

从 CatOut 中删掉 age 声明，再请求 `/broken`。

**答案：** 变成 200，因为新的响应契约不要求 age。这说明是契约决定合法性，不是框架“总能知道业务数据完整不完整”。做完练习请恢复原例。

### 3.5 第一次自动检查：只需要会读 assert

把下面保存为 `check03.py`，与 lesson03.py 放在一起：

```python
# file: check03.py
from fastapi.testclient import TestClient

from lesson03 import app

with TestClient(app, raise_server_exceptions=False) as client:
    response = client.get("/cats/1")
    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": "Mimi", "age": 2}
    assert client.get("/cats/abc").status_code == 422
    assert client.get("/cats/999").status_code == 404
    assert client.get("/broken").status_code == 500

print("lesson03 checks passed")
```

运行 `uv run python check03.py`，不需要启动 Uvicorn。TestClient 在进程内向应用发请求，assert 表示“实际结果必须等于我声明的预期”。

这里设置 `raise_server_exceptions=False` 才能直接断言 500；默认模式会将服务端异常重新抛给测试，方便定位 bug。两者不意味着真实 HTTP 行为不同。

**关于一条可能出现的 warning：** 本地 Starlette 1.3.1 的 TestClient 在没有安装 httpx2 时，会回退到 httpx 并提示 `StarletteDeprecationWarning`。本教程验证时出现了该提示，但断言正常通过；它不是 handler 出错，也不需要改你的业务代码。后续升级测试依赖时再按 [Starlette 发布说明](https://starlette.dev/release-notes/)处理。不要把所有 warning 一律屏蔽，也不必为这条提示打断当前练习。

**验收：** 能解释为什么错误输入是 422，而错误输出是 500；能自己加一条断言，不需要先掌握完整测试框架。

回到项目：看 `routers/cats.py` 的 `response_model=CatBreed` 与 `HTTPException(404)`。

资料：[Response Model](https://fastapi.tiangolo.com/tutorial/response-model/)、[Handling Errors](https://fastapi.tiangolo.com/tutorial/handling-errors/)、[Testing](https://fastapi.tiangolo.com/tutorial/testing/)。

---

## 4. 依赖：先理解“谁帮我调用”，再理解 yield

### 4.1 不用先背“依赖注入”这个名词

假设每个列表接口都需要解析分页参数。直接在函数体里调用 `get_limit()` 是你手动调函数；写 `Depends(get_limit)` 则是告诉 FastAPI：“请求到来时，请你调用这个函数，解析它需要的输入，把结果交给我。”

依赖不是只能用于数据库，也可以返回分页值、当前用户、配置或一个 service。它仍然是普通 Python 函数，只是框架负责调用与组合。

保存为 `lesson04.py`：

```python
# file: lesson04.py
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query

app = FastAPI()


def get_limit(limit: Annotated[int, Query(ge=1, le=20)] = 2):
    return limit


def get_store():
    print("store enter")
    try:
        yield {1: {"id": 1, "name": "Mimi"}, 2: {"id": 2, "name": "Luna"}}
    finally:
        print("store exit")


@app.get("/cats")
def list_cats(
    limit: Annotated[int, Depends(get_limit)],
    store: Annotated[dict, Depends(get_store)],
    fail: bool = False,
):
    print("handler")
    if fail:
        raise HTTPException(status_code=400, detail="Demo failure")
    return list(store.values())[:limit]


@app.get("/same-request")
def same_request(
    first: Annotated[dict, Depends(get_store)],
    second: Annotated[dict, Depends(get_store)],
):
    return {"same_object": first is second}
```

store 是专门演示生命周期的假资源，不是持久化数据库；`finally` 此时只打印日志。数据库关闭将在第六节替换进来。

### 4.2 请求时发生了什么？

```bash
curl -i 'http://127.0.0.1:8010/cats?limit=1'
curl -i 'http://127.0.0.1:8010/cats?fail=true'
curl -i http://127.0.0.1:8010/same-request
```

第一条返回只有 Mimi 的数组，并看到 `store enter → handler → store exit`。第二条返回 400，但仍然有 `store exit`。第三条返回 `{"same_object":true}`，get_store 在这次请求中只进入一次。

关键语法：

- `Depends(get_limit)` 传的是函数本身，不是 `Depends(get_limit())`。
- get_limit 自己声明了 Query 参数，因此 FastAPI 会继续解析它的依赖；这就是“依赖图”。
- `Depends` 通常在同一请求内复用同一个依赖的计算结果，不是跨请求全局缓存。本例 first 和 second 得到同一个对象。
- 对普通函数直接手动调用，FastAPI 不会介入解析 `Depends`。测试 handler 时优先走 TestClient 或显式传入依赖值。

对照 NestJS：效果接近由容器提供 Provider，但 FastAPI 主要用函数签名构造依赖图，不要求你为每个依赖写一个 class。

### 4.3 yield 为什么能“先交出结果，后继续清理”？

含有 yield 的普通 `def` 是生成器函数：调用它先得到生成器对象；推进到 yield 时交出一个值并暂停。框架让它先跑到 yield，把值传给 handler，结束时再驱动它退出。

`finally` 表达的是“不管正常结束还是异常，都执行清理”。不要把清理只写在 yield 后且没有 try/finally，否则异常路径可能跳过那段普通代码。

当前 FastAPI 默认对 yield dependency 使用 request scope：清理通常发生在响应发送完成后。`Depends(get_store, scope="function")` 则在 handler 执行完、响应发送前清理；这会影响流式响应中资源是否仍然可用。

**不要在默认 yield 依赖的清理阶段才 commit。** 那时成功响应可能已经发出，提交失败来不及变成正确的错误状态。第六节会在 handler 返回前显式提交。

补充一个容易误记的点：依赖求值与参数校验可能交错。非法请求也可能执行部分依赖及其清理；不要把整体流程死记成“所有校验成功后才执行任何依赖”。副作用性操作仍应放在明确的业务阶段。

### 4.4 只改一处

把 same_request 的 second 改为 `Depends(get_store, use_cache=False)`，再请求。

**答案：** 返回 false；这次会分别创建两个 dict，并分别执行清理。改完观察日志，再恢复。

### 4.5 看懂“替换依赖”比学 mocking 框架更重要

保存为 `check04.py`：

```python
# file: check04.py
from fastapi.testclient import TestClient

from lesson04 import app, get_store


def fake_store():
    return {99: {"id": 99, "name": "Test Cat"}}


app.dependency_overrides[get_store] = fake_store
try:
    with TestClient(app) as client:
        response = client.get("/cats?limit=1")
        assert response.json() == [{"id": 99, "name": "Test Cat"}]
finally:
    app.dependency_overrides.pop(get_store, None)

print("lesson04 checks passed")
```

运行 `uv run python check04.py`。handler 没变，但数据来源换成 fake，测试不需要真实数据库。用 finally 撤销替换，避免污染后续测试。

**验收：** 能说出 Depends 由谁调用、返回值传到哪里、为什么用函数而不是函数调用、什么时候释放资源。

回到项目：看 `backend/db.py` 的 `get_session()`，把 `yield { ... }` 替换成 `yield session` 来理解，而不是一下子追完整数据库实现。

资料：[Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)、[Dependencies with yield](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/)、[Dependency Overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/)。

---

## 5. 异步：async def 不是更快的 def

### 5.1 先把问题说具体

四个请求各要等 0.25 秒。如果等待期间可以让出事件循环，它们可以重叠等待，总时间接近 0.25 秒；如果每个请求把事件循环堵住，总时间就接近 1 秒。

这里的等待是演示 I/O 等待的替身，不是模拟 CPU 推理速度。先用这个实验看见调度差异，再讨论数据库或 LLM。

保存为 `lesson05.py`：

```python
# file: lesson05.py
import asyncio
import time

from fastapi import FastAPI

app = FastAPI()


@app.get("/good")
async def good():
    await asyncio.sleep(0.25)
    return {"mode": "async wait"}


@app.get("/bad")
async def bad():
    # Deliberately blocks the event loop. Do not copy into production.
    time.sleep(0.25)
    return {"mode": "blocking wait"}


@app.get("/sync")
def sync():
    time.sleep(0.25)
    return {"mode": "thread-pool wait"}
```

启动后可先各请求一次：

```bash
curl -i http://127.0.0.1:8010/good
curl -i http://127.0.0.1:8010/bad
curl -i http://127.0.0.1:8010/sync
```

单次都约等待 0.25 秒，因此**仅看单个请求耗时，看不出并发差异**。

### 5.2 可直接运行的并发实验

保存为 `probe05.py`，运行 `uv run python probe05.py`。它直接在进程内驱动应用，无需 Uvicorn，也无需联网：

```python
# file: probe05.py
import asyncio
from time import perf_counter

import httpx

from lesson05 import app


async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://study") as client:
        for path in ("/good", "/bad", "/sync"):
            started = perf_counter()
            responses = await asyncio.gather(*(client.get(path) for _ in range(4)))
            assert all(response.status_code == 200 for response in responses)
            print(path, round(perf_counter() - started, 2), "seconds")


asyncio.run(main())
```

预期数量级：good 和 sync 接近 0.25 秒，bad 接近 1 秒。实际值有调度和机器负载开销，不以“必须恰好 0.25”为断言。这是单事件循环教学实验，不是服务性能压测；真实并发还受线程池、连接池、代理和部署 worker 数量限制。

### 5.3 三条路径为什么不同？

- `async def + await asyncio.sleep`：等待对象未就绪时暂停当前协程，让事件循环处理其他请求。
- `async def + time.sleep`：同步函数直接占住事件循环线程；函数写了 async 也不会自动隔离内部阻塞。
- 普通 `def` 路由：FastAPI 将同步 handler 放到线程池执行；此处等待可在线程中重叠，但线程池不是无限的。

最重要的边界：**自动放线程池的是 FastAPI 调度的同步路由和同步依赖，不是你在 async 函数里随手调用的所有普通函数。**

例如在 async handler 中调用同步 `repo.get_cat()`，它仍在当前执行线程运行。函数被分到 Repository 文件，不会改变运行时行为。

### 5.4 把 Promise 经验迁移过来，但不要完全等同

| JavaScript | Python |
| --- | --- |
| 调用 async function 会开始执行，返回 Promise | 调用 async def 默认只创建 coroutine，要 await 或调度后才执行 |
| `await promise` | `await coroutine/task/awaitable` |
| `Promise.all(...)` | `asyncio.gather(...)`，不要误以为失败/取消语义完全相同 |
| 同步长计算阻塞事件循环 | 同样会阻塞；加 async 关键字不能解决 |

`asyncio.gather` 在上例安排多个请求共同推进；若你在 for 循环里每次都先 `await client.get(...)` 再下一次，那是依次等待。

`await` 不保证每次都切换任务：等待已经完成的对象可能立即继续。真正关心的是耗时操作有没有非阻塞等待点。

### 5.5 工作中怎么选？

| 要执行的操作 | 当前阶段的选择 |
| --- | --- |
| 同步 SQLModel 查询、同步网络 SDK | 普通 def 路由是简单起点 |
| 原生 async HTTP/DB SDK | async def + await |
| async 流程偶尔需要阻塞调用 | 受控地 `await asyncio.to_thread(...)`，并处理并发容量 |
| CPU 密集纯 Python 计算 | 评估进程池或独立任务服务，而非默认靠线程 |

在线程之间不要共享同一个 SQLAlchemy Session。若用 `to_thread` 包含数据库操作，资源创建、使用、关闭应在同一个受控工作单元中；不要把当前请求的 Session 随意递给并发任务。

这里不是要求你马上把项目改成 AsyncSession。先能够识别“同步操作跑在哪里”，再选择迁移方案。

### 5.6 只改一处

把 bad 的 `async def` 改成普通 `def`，重新运行 probe05。

**答案：** 该路由进入线程池，四次等待可以重叠。再把 good 中的 `await` 去掉会怎样？coroutine 没有被等待，路由通常会立即返回，并可能出现“coroutine was never awaited”警告；它不是“后台自动执行”。

**验收：** 不看资料说明一个 sync helper 在 async route 中运行在哪里；能区分“并发等待”与“CPU 并行”。

回到项目：`backend/routers/cats.py` 的部分查询路由是 async，但调用同步 SQLModel；聊天医疗分支的 embedding/检索也是需要检查的同步工作。本教程不修改它们，只用实验建立识别依据。

资料：[FastAPI Async](https://fastapi.tiangolo.com/async/)、[Python Coroutines and Tasks](https://docs.python.org/3.14/library/asyncio-task.html)。

---

## 6. 把概念合起来：数据库、Session 与生命周期

### 6.1 先区分三个生命期

| 对象 | 谁拥有 | 什么时候创建/结束 |
| --- | --- | --- |
| app / Engine | 应用进程 | 应用加载时创建，关闭时释放资源 |
| Session | 一次请求的依赖 | 依赖进入时创建，请求退出时关闭 |
| Transaction | 一次数据库工作单元 | 实际执行数据库操作时开始，commit/rollback 结束 |

Engine 管理连接获取和连接池，不等于“全局唯一一条连接”；Session 是跟踪 ORM 对象和事务工作的单位，不等于一张表。一次 Session 可以经历多次事务，但本例每个写接口只做一次提交。

本节首次落盘，使用示例文件旁边的 `lesson06.sqlite3`，**不读取项目 .env、不连接 PostgreSQL、不加载模型**。选择 SQLite 是为了专注资源生命周期，不能由它的行为推断 PostgreSQL 的锁和并发性能。

### 6.2 完整示例

这是唯一稍长的例子。先看模型和 get_session，跑通新增/查询后，再读 update/delete。

保存为 `lesson06.py`：

```python
# file: lesson06.py
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Field as SQLField
from sqlmodel import Session, SQLModel, create_engine, select

db_file = Path(__file__).with_name("lesson06.sqlite3")
engine = create_engine(
    f"sqlite:///{db_file}",
    connect_args={"check_same_thread": False},
)


class CatRow(SQLModel, table=True):
    id: int | None = SQLField(default=None, primary_key=True)
    name: str
    age: int


class CatCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=30)
    age: int = Field(ge=0, le=30)


class CatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    age: int


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    print("app ready")
    try:
        yield
    finally:
        engine.dispose()
        print("app stopped")


app = FastAPI(lifespan=lifespan)


def get_session():
    with Session(engine) as session:
        print("session enter")
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            print("session leaving")


SessionDep = Annotated[Session, Depends(get_session)]


@app.post("/cats", response_model=CatOut, status_code=201)
def create_cat(data: CatCreate, session: SessionDep):
    cat = CatRow(**data.model_dump())
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@app.get("/cats", response_model=list[CatOut])
def list_cats(session: SessionDep):
    return session.exec(select(CatRow).order_by(CatRow.id)).all()


@app.get("/cats/{cat_id}", response_model=CatOut)
def get_cat(cat_id: int, session: SessionDep):
    cat = session.get(CatRow, cat_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Cat not found")
    return cat


@app.put("/cats/{cat_id}", response_model=CatOut)
def update_cat(cat_id: int, data: CatCreate, session: SessionDep):
    cat = session.get(CatRow, cat_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Cat not found")
    cat.name = data.name
    cat.age = data.age
    session.commit()
    session.refresh(cat)
    return cat


@app.delete("/cats/{cat_id}", status_code=204)
def delete_cat(cat_id: int, session: SessionDep):
    cat = session.get(CatRow, cat_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Cat not found")
    session.delete(cat)
    session.commit()
```

### 6.3 模型为什么分成三种？

- `CatCreate`：HTTP 输入，禁止客户端传 id，校验名字和年龄。
- `CatRow`：数据库表与 ORM 对象；`table=True` 让 SQLModel 把它登记成表。
- `CatOut`：HTTP 输出，id 已产生所以必须是 int；`from_attributes=True` 允许从 ORM 对象属性读取数据。

`CatRow(**data.model_dump())` 中的 `**` 是把 dict 展开成关键字参数，相当于 `CatRow(name=data.name, age=data.age)`，不是 TypeScript 的类型断言。

本例的年龄限制只在 HTTP 输入模型上，没有声明数据库 CHECK。其他写入口仍可能写入非法年龄。生产需要对重要不变量补数据库约束，不能把 Pydantic 当成数据库保护层。

### 6.4 一次新增，逐行跟踪

执行：

```bash
curl -i -X POST http://127.0.0.1:8010/cats \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mimi","age":2}'
```

新数据库中首次结果为 201 与 `{"id":1,"name":"Mimi","age":2}`；已有数据时 id 不一定是 1。后续查询/更新/删除请使用实际返回的 id。

新增流程：

1. FastAPI 解析请求与依赖，构建 CatCreate，取得请求 Session。
2. `CatRow(...)` 构建 Python ORM 对象，此时还不等于数据库已经保存。
3. `session.add(cat)` 登记待保存对象。
4. `session.commit()` 先 flush 待执行 SQL，再提交事务，数据持久化。
5. `session.refresh(cat)` 重新从数据库加载，包括数据库生成的 id；本例写得显式，便于理解。
6. handler 返回 cat，经 CatOut 输出校验/序列化，发送 201。
7. get_session 退出，`with Session(...)` 关闭 Session，归还连接；日志 `session leaving` 位于 with 真正退出之前。

`commit()` 完成后，即使客户端随后断开或响应序列化失败，数据库写入也不会自动撤销。数据库事务不能覆盖整个网络交付；重试写接口需要额外考虑幂等性。

### 6.5 with、yield、rollback 怎么协作？

`with Session(engine)` 相当于把创建/退出资源的细节交给上下文管理器。`yield session` 让 FastAPI 在中间使用它。出现异常时，本例先显式 rollback，再 `raise` 原异常，最终仍退出 with。

必须区分：

- **关闭 Session 不会替你提交。** 尚未提交的事务会回滚/释放。
- **flush 不等于 commit。** SQL 可以已执行、id 已获得，但仍可回滚。
- **rollback 不会撤销过去已成功 commit 的事务。** 它针对当前未提交事务。
- **失败别吞异常。** 如果依赖 catch 后不 raise，调用方可能得不到正确错误。

当前所有数据库 handler 都是普通 def，因为使用同步 SQLModel。SQLite 的 `check_same_thread=False` 是为了允许驱动连接在不同线程使用，**不表示 Session 可以被多个请求或并发任务共享**；不要把这个连接参数直接复制到 PostgreSQL。

### 6.6 lifespan 的 yield 与依赖的 yield 有什么区别？

语法相似，管理的范围不同：

```text
应用启动：lifespan 进入 → create_all → app ready
  请求 A：Session A 创建 → handler → commit/rollback → Session A 关闭
  请求 B：Session B 创建 → handler → commit/rollback → Session B 关闭
应用停止：lifespan 退出 → dispose Engine → app stopped
```

lifespan 要用 `@asynccontextmanager` 包装成异步上下文管理器；传给 Depends 的生成器依赖通常直接用 yield，不需要同样的装饰器，因为 FastAPI 会为依赖管理这个过程。

本例的小型 `create_all` 在启动阶段同步执行，是教学简化；不要在每个请求建表，也不要把生产 migration/大型模型加载无条件复制到每个 worker 启动流程。多 worker 各有一份 Engine 和 lifespan。生产用版本化迁移，`create_all` 不会自动把旧表改成新结构。

### 6.7 只改一处：去掉 commit 会怎样？

在 create_cat 中把 `session.commit()` 换成 `session.flush()`，保留 refresh。新增可能仍返回 201 和一个 id，因为 SQL 已在当前事务执行；但请求结束关闭 Session 后，未提交事务被回滚，再查询这个 id 会得到 404。

**这就是“接口返回成功”不等于“数据库已持久化”的最小反例。** 做完恢复 commit，再继续后面的检查。

### 6.8 自动检查完整 CRUD

保存为 `check06.py`，运行 `uv run python check06.py`。它只创建并删除自己的示例猫咪，不清空已有表：

```python
# file: check06.py
from fastapi.testclient import TestClient

from lesson06 import app

with TestClient(app) as client:
    response = client.post("/cats", json={"name": "Study Cat", "age": 2})
    assert response.status_code == 201
    cat_id = response.json()["id"]
    try:
        assert client.get(f"/cats/{cat_id}").json()["name"] == "Study Cat"
        updated = client.put(f"/cats/{cat_id}", json={"name": "New Name", "age": 3})
        assert updated.status_code == 200
        assert updated.json()["age"] == 3
        assert client.put(f"/cats/{cat_id}", json={"name": "Missing Age"}).status_code == 422
        assert client.post("/cats", json={"name": "Bad Age", "age": -1}).status_code == 422
        rows = client.get("/cats").json()
        assert any(row["id"] == cat_id for row in rows)
    finally:
        deleted = client.delete(f"/cats/{cat_id}")
        assert deleted.status_code == 204
        assert deleted.content == b""
    assert client.get(f"/cats/{cat_id}").status_code == 404

print("lesson06 checks passed")
```

`with TestClient(app)` 很重要：它会进入和退出应用 lifespan；只创建 `TestClient(app)` 而不使用 with，不会以相同方式触发启动/关闭。新数据库尚未建表时尤其容易踩这个问题。

本例 PUT 是完整更新，name 和 age 都必传；PATCH 的部分更新、`exclude_unset=True` 和 null 语义属于后续练习，先不要混入本节。

**验收：** 能逐行解释新增接口，知道 Session 为什么不是全局单例，能说明 flush/commit/rollback/close 的差别。

回到项目：对照 `backend/db.py`、`models/cat.py`、`repositories/cats.py` 的 create_breed，以及 `main.py` 的 lifespan。真实项目只是把示例拆到不同文件，并扩充字段；分层本身不改变这些执行规则。

资料：[SQLModel Session Dependency](https://sqlmodel.tiangolo.com/tutorial/fastapi/session-with-dependency/)、[SQLAlchemy Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html)、[FastAPI Lifespan](https://fastapi.tiangolo.com/advanced/events/)。

---

## 7. 学完再回项目：只跟踪一个接口

不要马上从 `chat.py`、模型工厂或 RAG 入口开始。先跟踪 `GET /api/cats/{cat_id}`：

```text
main.py：include_router(cats.router)
    ↓ 注册 /api/cats 前缀
routers/cats.py：get_cat(cat_id, session=Depends(get_session))
    ↓ 获取当前请求 Session
repositories/cats.py：get_breed(session, cat_id)
    ↓ session.get(CatBreedRow, cat_id)
models/cat.py：CatBreedRow
    ↓ 转为公开响应模型
schemas/daily_cat.py：CatBreed
    ↓ response_model 校验与序列化
HTTP 响应
```

APIRouter 是可组合的路由集合：`prefix="/api/cats"` 加上 `@router.get("/{cat_id}")` 才形成完整路径。只创建 router 而没有 `app.include_router(router)`，主应用就没有这条路由。

读到一个函数，只做五个标注：

1. 输入从 HTTP、另一个函数还是依赖系统来？
2. 谁调用它，何时调用？
3. 有没有阻塞 I/O，它运行在哪个线程/事件循环？
4. 返回的是 dict、Pydantic model、ORM row，还是 Response？
5. 出错由谁处理，资源由谁关闭？

如果五个问题能答出，已经开始具备 review 这条链路的能力。暂时不用判断整个架构“好不好”。

资料：[Bigger Applications / APIRouter](https://fastapi.tiangolo.com/tutorial/bigger-applications/)。

---

## 8. 选读：为 LangChain 流式接口留一个入口

只有前六节能解释清楚后再看。不接真实模型，只演示“分批生成字符串”：

```python
# file: lesson07_stream.py
import asyncio
import json

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()


async def events():
    try:
        for text in ("Miao", " Miao", "!"):
            await asyncio.sleep(0.1)
            yield f"event: chunk\ndata: {json.dumps({'text': text})}\n\n"
        yield "event: done\ndata: {}\n\n"
    finally:
        print("stream cleaned up")


@app.get("/stream")
async def stream():
    return StreamingResponse(events(), media_type="text/event-stream")
```

运行 `uv run uvicorn lesson07_stream:app --port 8010`，另开终端：

```bash
curl -N http://127.0.0.1:8010/stream
```

`-N` 关闭 curl 输出缓冲，便于观察逐步到达。这里 async generator 的 yield 是“交出下一段数据”，不是请求依赖的“借出一个资源”；同一个 Python 机制被用在两个不同协议中。

把循环中等待/生成文本的部分换成模型的 async stream，就接近项目的 LLM 流。HTTP headers 已发出后不能再把 200 改成 500，因此流内错误需要约定 error 事件。代理缓冲、取消传播、超时和真实首 Token 延迟仍需单独验证；普通 TestClient 往往会收集完整 body，不能证明网络逐 Token 到达。

本例采用与项目一致的 `StreamingResponse` 手工 SSE framing，不代表 FastAPI 没有更专用的 SSE API。先理解协议，再比较封装，详见 [Stream Data](https://fastapi.tiangolo.com/advanced/stream-data/)。

---

## 9. 最后的练习：允许查资料，不允许直接复制整段

先完成填空，再尝试小改造，不要求一次从零写全：

| 阶段 | 任务 | 验收 |
| --- | --- | --- |
| 读懂 | 用自己的话解释 lesson03 每段代码 | 能区分输入与输出校验 |
| 改动 | 给 CatCreate 新增可省略的 nickname | 能预测缺省/null/字符串三种输入 |
| 补全 | 遮住 lesson06 的 create_cat，只补出 add/commit/refresh | 新增后另一次请求可读到 |
| 迁移 | 把 get_cat 注册到一个 APIRouter | include 前 404，include 后正常 |
| 独立小功能 | 新增按年龄筛选的列表 Query | 对合法值、非法值、无结果各写一条 assert |

达到这个阶段，再让 AI 帮你 review 自己写的 20–40 行，比让你 review 一整个 AI 生成后端更适合当前学习目标。可以这样提问：

> 请不要直接重写。先让我预测这段代码的请求与响应，再指出一个关键问题，解释运行时会发生什么，最后只给一个最小修改提示。

### 暂时不学的内容

JWT/OAuth 完整体系、Middleware 自定义栈、复杂 DI 容器、Async ORM 迁移、任务队列、Docker、RAG 和 Agent 都暂缓。它们不是不重要，而是需要先站在请求/响应、资源与并发这几个基础之上。

资料无需另开十几个课程：卡在语法时看 [Python Types Intro](https://fastapi.tiangolo.com/python-types/)，卡在某个模块时使用该节后的官方链接。原有 FastAPI × LangChain 面试手册留到完成这里的验收后再读。

### 示例验证说明

本次从 Markdown 直接提取了 11 个完整 Python 代码块，在独立临时目录运行，并额外验证六个主要“只改一处”变体，共通过 72 项检查。覆盖请求转换/校验、响应过滤/异常、依赖复用与异常清理、异步阻塞对照、SQLite CRUD、回滚与生命周期、SSE 帧格式。

并发实验中四请求耗时约为：异步等待 0.26 秒、事件循环内阻塞 1.02 秒、线程池等待 0.26 秒，仅用于解释本例调度机制。SSE 检查覆盖帧内容和生成器正常结束清理，不代表已验证反向代理、网络逐 Token 到达或客户端断连传播。未连接项目 PostgreSQL、调用真实模型或更改项目依赖。
