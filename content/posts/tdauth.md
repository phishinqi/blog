---
title: TouchDesigner 逆向笔记
description: |-
  > 目标：`libTD.dll`，TouchDesigner 2025.33230 核心引擎，138 MB PE32+ x64。
  >
  > 本文记录完整的逆向工程过程：符号提取 → 反编译 → TEA 加密还原 → CRC32 验证 → 系统码反推 → keygen 实现。全部算法通过二进制代码执行验证（Unicorn），不依赖推断。
slug: tdauth
pubDate: 2026-10-10T01:47:19+08:00
category: technology
tags:
  - 技术
  - 逆向分析
authors:
  - elarais
lang: zh-CN
featured: true
showCopyright: true
license: all-rights-reserved
---
## 0x0 前言

商业软件的鉴权套路就那么几种。序列号+本地算法校验、RSA 签名的许可文件、USB 加密狗、云端 Token、服务端实时判定。真正能出 keygen 的只有第一种——算法全在客户端，读懂了就能照着构造输入。RSA 那种没私钥，加密狗得 hook API，云端的心跳得复刻后端，都不是一个量级的麻烦。

TD 是本地跑的图形软件，校验没有完全押在云端上，代码就在手上这个 DLL 里。只要把它“认什么输入是合法的”这件事读明白，构造一个满足全部检查的输入就完事了。

## 0x1

对于一个 138MB 的文件来说，这个体量有点太大了。全量反编译？几万个函数，看不完，根本看不完。但编译器不会把东西全抹干净——导出表和 RTTI 里留着一大堆符号名。license、protection、key 这种词只要在符号里出现，就是官方插好的路标。这一步连反汇编都不用，读 PE 导出表几秒的事。  
搜索字符串 `non-commercial`、`educational`、`key format` 找到地址记录下来。

## 0x2

```python
def find_string_refs(substring):
    target = None
    for s in bv.strings:
        if substring in str(s):
            target = s.start
            break
    if target is None:
        print("String not found")
        return
    for ref in bv.get_code_refs(target):
        print(hex(ref.address), ref.function.name, hex(ref.function.start))

find_string_refs("Unrecognized key format")

```

直接指到 `0x181293810`，密钥解析器。  
跳过去读 HLIL，`0x1812938e7` 处一眼就是：

```c
result = sub_1811a4910(arg3, "%d %s %s %s %s %s", &var_1d4, ...);

```

`%d` 进 var\_1d4，后面校验要求它等于 0。五个 `%s` 进五个缓冲区，每个都必须是 8 个 hex 字符。输入格式钉死：`0 h1 h2 h3 h4 h5`  
五个 hex 串转五个 DWORD，dw0 到 dw4。往下走，数据块过 TEA 家族解密，然后撞一排闸门：

- **G1**：sscanf 返回值不等于 6、var\_1d4 不为 0、五个子串有任何一个长度不是 8 —— 全算 G1，当场置 0  

- **G2**：密钥格式错  

- **G3**：CRC 校验和对不上  

- **G4**：System Code 不匹配  

- **G5**：版本不支持  

- **G6**：订阅过期  


## 0x3 TEA

内联循环里全是 `<<4`、`>>5`、一坨 XOR，轮数 32，常数 0x61C88647（delta 的负数补码形式）。但是这货的常数是魔改过的，标准 TEA 直接套必然翻车。所有常数、所有运算顺序，都得对着汇编一条条抄。

### tea\_schedule

按 G 到 `0x1812F3350`，切汇编视图。抄这五样：

| 抄什么        | 值                                           |
| ---------- | ------------------------------------------- |
| 每轮 sum 怎么变 | `r9 -= 0x61C88647`（等价 `+= delta`）           |
| 先更新的变量     | `ecx += f(r8)`，用的旧 r8                       |
| 后更新的变量     | `r8 += g(ecx_new)`，用的新 ecx                  |
| f 的常数      | `(r8<<4)+0x1AD342EF`、`(r8>>5)-0x68CDBD2A`   |
| g 的常数      | `(ecx<<4)+0x48725213`、`(ecx>>5)-0x6516701D` |

### 主循环

tea\_schedule 只是出钥匙的，真正解密在 `0x181293A90`。这地方几个坑，全靠汇编+MLIL 对照抠。

外层循环：r12 从 **1** 开始，步进 2，边界 r12 &lt; 5。数组基址 rsp+0x50（就是 dw0）。代入算：r12=1 取 dw1、dw2；r12=3 取 dw3、dw4。

所以 TEA 只碰 (dw1,dw2) 和 (dw3,dw4) 两组，**dw0 不参与解密**——它被直接抓来当第四把钥匙：`mov r11d, [rsp+0x50]`。

```c
// sum 初值 0xC6EF3720 = 32 * delta
for (int i = 0x20; i != 0; --i) {
    // 1. 先更新 r8d，用旧的 edx
    r8d -= ((edx >> 5) + key2) ^ ((edx << 4) + key1) ^ (sum + edx);

    // 2. 再更新 edx，用刚更新的 r8d
    edx -= ((r8d >> 5) + key0) ^ ((r8d << 4) + key3) ^ (sum + r8d);

    // 3. sum += delta，对应 lea r9d, [r9-0x61c88647]
    sum += delta;
}

```

key0/1/2 是三次 tea\_schedule 的产物，key3 = dw0 原值。循环完写回 edx、r8d，索引 +2。

## 0x4 CRC32

G3 门算 CRC32，函数在 `0x1812F33C0`。跳过去看三样东西：

- 开头 `test dword [0x185FB1F80], 0`  

- 表生成循环 poly `0x4C11DB7`，配 `cmovns`  

- 计算循环 `v = table[b ^ (v>>24)] ^ (v<<8)`，输入 16 字节  
python 实现  


```python
# 首步测 bit7，后 7 步测 bit31（MSVC 符号位分支）
for i in range(256):
    v = i
    v = ((v << 25) ^ POLY) & MASK if (v & 0x80) else (v << 25) & MASK
    for _ in range(7):
        v = ((v << 1) ^ POLY) & MASK if (v & 0x80000000) else (v << 1) & MASK

```

## 0x5 ins5.dat

TEA 的 key0 绑系统码，翻 ProgramData，找到 `C:\ProgramData\Derivative\ins5.dat`：  
`df2c4930 811ffe19+546977234e7a72273a3c2a...`

追引用 `"ins5.dat"` 字符串的写入函数（`0x181294F50`），读它的 fprintf 逻辑：

- 第一段：`tea_schedule(系统码)` → `"%08x"` → 输出 `df2c4930`  

- 第二段：系统码原值 → `"%08x"` → 输出 `811ffe19`  
两个结论到手：  


1. **TD 界面上显示的 system code 不是裸的系统码**。df2c4930 是 `tea_schedule(0x811FFE19)` 的输出，TEA 加密用的是 811FFE19。
2. 已知明文：`tea_schedule(0x811FFE19) == 0xDF2C4930`。直接拿来验第 3 步的实现，一次对上，说明常数抄对了。  
再往上摸一层：写入函数上游调哈希（`sub_181295CB0` → `sub_181291670`），哈希上游调 WMI——COM 查 10 项硬件信息（BIOS/OS/CPU/主板 UUID）加注册表 MachineGuid，拼一起过 32 轮哈希压成 32 位指纹。

## 0x6

TEA encrypt 手写完，round-trip 回不到原文。可疑点有三个：常数、更新顺序、sum 方向。手写对手写，完全没法定位。

解法粗暴的办法：把二进制自己的字节码（`0x181293AB0..0x181293AF1`）抠出来塞进 Unicorn，按二进制的寄存器约定摆输入，让二进制代码自己跑。它跑出来的绝对就是标准答案。

```python
mu = Uc(UC_ARCH_X86, UC_MODE_64)
mu.mem_map(0x10000, 0x1000)
mu.mem_write(0x10000, LOOP_BYTES)
mu.reg_write(UC_X86_REG_RDX, 0xDEADBEEF)   # edx = 第一元素
mu.reg_write(UC_X86_REG_R8,  0xCAFEBABE)   # r8  = 第二元素
mu.reg_write(UC_X86_REG_R9,  0xC6EF3720)   # sum
mu.reg_write(UC_X86_REG_RBX, key0)
mu.reg_write(UC_X86_REG_RDI, key1)
mu.reg_write(UC_X86_REG_RSI, key2)
mu.reg_write(UC_X86_REG_R11, key3)
mu.reg_write(UC_X86_REG_R10, 0x20)         # 32 轮

```

decrypt 和二进制一致，encrypt 不一致。回头细查，encrypt 的 sum 方向写反了——用成了 `-delta` 的补码形式，应该是 `+delta`。改完 round-trip 通过。

## 0x7 暴力反推

给别人的机器出密钥，对方只能给你界面上那个 System Code，我们需要拿到真实的 System Code。

tea\_schedule 是 32→32 的双射，解存在且唯一。但内部状态 64 位（ecx+r8），输出只露 32 位。固定点迭代？试了，XOR+移位的非线性让迭代来回震荡，不收敛。BSGS/彩虹表？得 2^32 空间预计算，不比暴力省。

暴力破解，C 多线程，每个 worker 分一段区间，forward 算完比对：

```c
for (uint64_t a1 = start; a1 <= end; a1++)
    if (tea_schedule((uint32_t)a1) == target) { found = 1; break; }

```

## 0x8

密钥塞进去，TD 显示 successfully installed，六个门全过，说明格式对了。  
回类型归并函数读映射：

```
licType 1 → Non-Commercial
licType 3 → Commercial
licType 4 → Pro
licType 7 → Educational

```

licType≠1 的走 G6' 时，dw3 必须是未来日期（YYYYMMDD 整数），不然报 Updates Expired。  
改 licType=4，dw3=20991231，重出。  
至此完整的 Key 就已经计算完了。

## 0x9

```
输入: TD 显示的 system code (比如 df2c4930)
  │
  ├─ 有 ins5.dat? → 第二个字段直接就是裸系统码        (瞬间)
  └─ 没有?        → 暴力 2^32 反推                   (~60s)
  ↓
key0 = tea_schedule(0x811FFE19)
key1 = tea_schedule(0x912AF81F)
key2 = tea_schedule(0x3E9E83BF)
key3 = dw0 (自选)
  ↓
明文: dw1=4(Pro)  dw2=0x00070236(ver=99)  dw3=20991231
dw4 = CRC32(dw0..dw3)        ← CRC 算在明文上
  ↓
(c1,c2) = TEA_encrypt(dw1, dw2, key0..3)
(c3,c4) = TEA_encrypt(dw3, dw4, key0..3)
  ↓
写 ins2.dat: "0 <dw0> <c1> <c2> <c3> <c4>"

```

## 仅供学习交流使用

