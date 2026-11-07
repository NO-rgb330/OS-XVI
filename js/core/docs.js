  export const PYTHON_DOC = `
# PYTHON PROGRAMMING CHEAT SHEET
## Complete Reference: Beginner to Advanced
/# PYTHON PROGRAMMING CHEAT SHEET
## Complete Reference: Beginner to Advanced
**Language:** Python 3  
**Level:** Beginner → Advanced  
**Purpose:** Syntax reference, programming guide and practical examples

---

# TABLE OF CONTENTS

1. Python Fundamentals
2. Variables and Data Types
3. Type Conversion
4. Operators
5. Strings and String Manipulation
6. Input and Output
7. Conditional Statements
8. Loops and Iteration
9. Lists
10. Tuples
11. Sets
12. Dictionaries
13. Functions
14. Lambda Functions
15. List, Dictionary and Set Comprehensions
16. Error Handling and Exceptions
17. File Handling
18. Modules and Imports
19. Object-Oriented Programming (OOP)
20. Classes, Inheritance and Polymorphism
21. Advanced Functions
22. Iterators and Generators
23. Decorators
24. Context Managers
25. Regular Expressions
26. Working with Dates and Time
27. Mathematical Operations
28. Randomisation
29. Working with JSON
30. Working with CSV
31. Operating System Interaction
32. System Commands and Subprocesses
33. Networking and Internet Access
34. Multithreading and Multiprocessing
35. Asynchronous Programming
36. Type Hints
37. Debugging and Testing
38. Virtual Environments and pip
39. Useful Built-in Functions
40. Common Standard Libraries
41. Python Syntax Reference
42. Common Python Programming Patterns
43. Common Mistakes and How to Fix Them
44. Complete Example Programs

---

# 1. PYTHON FUNDAMENTALS

## 1.1 Printing information

The `print()` function displays information in the console.

```python
print("Hello World")
print(123)
print(True)
```

Output:

```text
Hello World
123
True
```

Printing multiple values:

```python
print("Hello", "World", 123)
```

Output:

```text
Hello World 123
```

Using separators:

```python
print("Python", "Java", "C++", sep=" | ")
```

Output:

```text
Python | Java | C++
```

Changing the ending character:

```python
print("Hello", end=" ")
print("World")
```

Output:

```text
Hello World
```

Printing an empty line:

```python
print()
```

## 1.2 Comments

Comments are ignored by Python and are used to explain code.

Single-line comment:

```python
# This is a comment
print("Hello")
```

Multiple-line comments are commonly written using multiple `#` symbols:

```python
# This is line one.
# This is line two.
# This is line three.
```

Triple-quoted strings can also be used for documentation:

```python
"""
This is a multiline string.
It can contain multiple lines.
"""
```

## 1.3 Indentation

Python uses indentation to determine which statements belong together.

Correct:

```python
if True:
    print("Inside the condition")
    print("Still inside")

print("Outside the condition")
```

Incorrect:

```python
if True:
print("Error")
```

The standard convention is four spaces per indentation level.

---

# 2. VARIABLES AND DATA TYPES

## 2.1 Creating variables

A variable stores information.

```python
name = "Nathan"
age = 13
height = 1.65
is_student = True
```

Python automatically determines the variable's data type.

You do not need to declare variable types before using them.

## 2.2 Variable naming rules

Valid:

```python
username = "Nathan"
user_age = 13
userAge = 13
_private = 10
number1 = 25
```

Invalid:

```python
1number = 25
user-name = "Nathan"
class = "Python"
```

Rules:
- Names cannot begin with numbers.
- Names cannot contain spaces.
- Names cannot use hyphens.
- Names cannot be Python keywords.
- Names are case-sensitive.

```python
name = "Nathan"
Name = "Alex"

print(name)
print(Name)
```

These are two different variables.

## 2.3 Main Python data types

| Data type | Description | Example |
|---|---|---|
| `int` | Whole numbers | `25` |
| `float` | Decimal numbers | `3.14` |
| `str` | Text | `"Hello"` |
| `bool` | True or false | `True` |
| `list` | Ordered, changeable collection | `[1, 2, 3]` |
| `tuple` | Ordered, unchangeable collection | `(1, 2, 3)` |
| `set` | Unique values | `{1, 2, 3}` |
| `dict` | Key-value collection | `{"name": "Alex"}` |
| `NoneType` | Represents no value | `None` |
| `complex` | Complex numbers | `3 + 4j` |

## 2.4 Checking data types

Use `type()`:

```python
number = 100
name = "Nathan"

print(type(number))
print(type(name))
```

Output:

```text
<class 'int'>
<class 'str'>
```

Use `isinstance()`:

```python
number = 10

print(isinstance(number, int))
print(isinstance(number, str))
```

Output:

```text
True
False
```

## 2.5 Assigning multiple variables

```python
a, b, c = 10, 20, 30

print(a)
print(b)
print(c)
```

Assigning the same value:

```python
x = y = z = 100
```

Swapping variables:

```python
a = 10
b = 20

a, b = b, a

print(a, b)
```

Output:

```text
20 10
```

---

# 3. TYPE CONVERSION

Type conversion changes one data type into another.

## 3.1 Common conversion functions

| Function | Purpose | Example |
|---|---|---|
| `int()` | Convert to integer | `int("25")` |
| `float()` | Convert to decimal | `float("3.14")` |
| `str()` | Convert to string | `str(100)` |
| `bool()` | Convert to Boolean | `bool(1)` |
| `list()` | Convert to list | `list("abc")` |
| `tuple()` | Convert to tuple | `tuple([1, 2])` |
| `set()` | Convert to set | `set([1, 1, 2])` |
| `dict()` | Create dictionary | `dict(a=1)` |
| `complex()` | Create complex number | `complex(2, 3)` |

Examples:

```python
number = int("100")
decimal = float("3.14")
text = str(123)
result = bool(1)

print(number)
print(decimal)
print(text)
print(result)
```

Converting a string containing a decimal into an integer directly will fail:

```python
number = int("3.14")  # ValueError
```

Instead:

```python
number = int(float("3.14"))
print(number)  # 3
```

---

# 4. OPERATORS

Operators perform operations on values and variables.

## 4.1 Arithmetic operators

| Operator | Meaning | Example | Result |
|---|---|---|---|
| `+` | Addition | `5 + 3` | `8` |
| `-` | Subtraction | `5 - 3` | `2` |
| `*` | Multiplication | `5 * 3` | `15` |
| `/` | Division | `5 / 2` | `2.5` |
| `//` | Floor division | `5 // 2` | `2` |
| `%` | Modulus/remainder | `5 % 2` | `1` |
| `**` | Exponentiation | `5 ** 2` | `25` |

Example:

```python
a = 10
b = 3

print(a + b)
print(a - b)
print(a * b)
print(a / b)
print(a // b)
print(a % b)
print(a ** b)
```

## 4.2 Comparison operators

These operators compare two values and return `True` or `False`.

| Operator | Meaning |
|---|---|
| `==` | Equal to |
| `!=` | Not equal to |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal to |
| `<=` | Less than or equal to |

Example:

```python
age = 13

print(age == 13)
print(age != 18)
print(age > 10)
print(age < 20)
print(age >= 13)
print(age <= 15)
```

## 4.3 Logical operators

| Operator | Meaning |
|---|---|
| `and` | Both conditions must be true |
| `or` | At least one condition must be true |
| `not` | Reverses a Boolean result |

Example:

```python
age = 13
has_permission = True

if age >= 13 and has_permission:
    print("Access granted")
```

Using `or`:

```python
is_admin = False
is_moderator = True

if is_admin or is_moderator:
    print("Can moderate")
```

Using `not`:

```python
is_locked = False

if not is_locked:
    print("Unlocked")
```

## 4.4 Assignment operators

| Operator | Equivalent |
|---|---|
| `=` | Assign |
| `+=` | `x = x + value` |
| `-=` | `x = x - value` |
| `*=` | `x = x * value` |
| `/=` | `x = x / value` |
| `//=` | `x = x // value` |
| `%=` | `x = x % value` |
| `**=` | `x = x ** value` |

Example:

```python
number = 10

number += 5
number -= 2
number *= 3

print(number)  # 39
```

## 4.5 Membership operators

Check whether something exists inside a collection.

- `in`
- `not in`

```python
fruits = ["apple", "banana", "orange"]

print("apple" in fruits)
print("grape" not in fruits)
```

Output:

```text
True
True
```

## 4.6 Identity operators

- `is`
- `is not`

These check whether two references point to the same object.

```python
a = [1, 2, 3]
b = a
c = [1, 2, 3]

print(a == c)  # True
print(a is c)  # False
print(a is b)  # True
```

Use `==` to compare values and `is` mainly for identity checks such as `x is None`.

## 4.7 Bitwise operators

Bitwise operators work directly with binary representations of integers.

| Operator | Meaning |
|---|---|
| `&` | AND |
| `|` | OR |
| `^` | XOR |
| `~` | NOT |
| `<<` | Left shift |
| `>>` | Right shift |

Example:

```python
a = 5   # Binary: 0101
b = 3   # Binary: 0011

print(a & b)   # 1
print(a | b)   # 7
print(a ^ b)   # 6
print(~a)      # -6
print(a << 1)  # 10
print(a >> 1)  # 2
```

---

# 5. STRINGS AND STRING MANIPULATION

Strings store text.

## 5.1 Creating strings

```python
name = "Nathan"
name2 = 'Nathan'
message = """This is
a multiline
string."""
```

## 5.2 String indexing

Each character has a position, starting at zero.

```python
text = "Python"

print(text[0])   # P
print(text[1])   # y
print(text[-1])  # n
print(text[-2])  # o
```

## 5.3 String slicing

Syntax:

```python
string[start:stop:step]
```

Examples:

```python
text = "Python Programming"

print(text[0:6])   # Python
print(text[:6])    # Python
print(text[7:])    # Programming
print(text[::2])   # Every second character
print(text[::-1])  # Reverse string
```

The ending position is excluded.

## 5.4 Common string methods

| Method | Purpose | Example |
|---|---|---|
| `.upper()` | Uppercase | `"hello".upper()` |
| `.lower()` | Lowercase | `"HELLO".lower()` |
| `.capitalize()` | Capitalise first character | `"hello world".capitalize()` |
| `.title()` | Capitalise each word | `"hello world".title()` |
| `.strip()` | Remove surrounding whitespace | `" hello ".strip()` |
| `.lstrip()` | Remove left whitespace | `" hello".lstrip()` |
| `.rstrip()` | Remove right whitespace | `"hello ".rstrip()` |
| `.replace()` | Replace text | `"cat".replace("c", "b")` |
| `.split()` | Split into a list | `"a,b".split(",")` |
| `.join()` | Join strings | `",".join(["a","b"])` |
| `.find()` | Find position | `"hello".find("e")` |
| `.index()` | Find position, raises error if absent | `"hello".index("e")` |
| `.count()` | Count occurrences | `"banana".count("a")` |
| `.startswith()` | Check beginning | `"hello".startswith("he")` |
| `.endswith()` | Check ending | `"hello".endswith("lo")` |
| `.isdigit()` | Check digit characters | `"123".isdigit()` |
| `.isalpha()` | Check letters | `"abc".isalpha()` |
| `.isalnum()` | Check letters and numbers | `"abc123".isalnum()` |
| `.isspace()` | Check whitespace | `" ".isspace()` |
| `.swapcase()` | Reverse letter case | `"Hello".swapcase()` |
| `.casefold()` | Aggressive lowercase for comparisons | `"HELLO".casefold()` |
| `.zfill()` | Pad with zeroes | `"42".zfill(5)` |

Example:

```python
text = "  hello python  "

print(text.strip())
print(text.upper())
print(text.replace("python", "world"))
```

## 5.5 f-strings

f-strings insert variables into strings.

```python
name = "Nathan"
age = 13

print(f"My name is {name} and I am {age}.")
```

Mathematical expressions:

```python
a = 10
b = 20

print(f"Total: {a + b}")
```

Formatting decimals:

```python
price = 19.999

print(f"${price:.2f}")
```

Output:

```text
$20.00
```

Formatting percentages:

```python
value = 0.756

print(f"{value:.1%}")
```

Output:

```text
75.6%
```

## 5.6 Escape characters

| Character | Meaning |
|---|---|
| `\n` | New line |
| `\t` | Tab |
| `\\` | Backslash |
| `\'` | Single quotation mark |
| `\"` | Double quotation mark |
| `\r` | Carriage return |
| `\b` | Backspace |
| `\0` | Null character |

Example:

```python
print("Hello\nWorld")
print("Name:\tNathan")
print("C:\\Users\\Nathan")
```

## 5.7 Raw strings

Raw strings do not interpret most backslash escapes.

```python
path = r"C:\Users\Nathan\Documents"

print(path)
```

Useful for Windows file paths and regular expressions.

---

# 6. INPUT AND OUTPUT

## 6.1 Getting user input

Use `input()`:

```python
name = input("Enter your name: ")

print("Hello", name)
```

Important: `input()` always returns a string.

Convert it when necessary:

```python
age = int(input("Enter your age: "))

print(age + 1)
```

Decimal input:

```python
price = float(input("Enter price: "))
```

## 6.2 Multiple inputs

```python
name, age = input("Enter name and age: ").split()

age = int(age)
```

Example input:

```text
Nathan 13
```

## 6.3 Printing formatted output

```python
name = "Nathan"
score = 95

print(f"Student: {name}")
print(f"Score: {score}/100")
```

---

# 7. CONDITIONAL STATEMENTS

Conditional statements execute code depending on whether a condition is true.

## 7.1 if

```python
age = 18

if age >= 18:
    print("Adult")
```

## 7.2 if and else

```python
age = 15

if age >= 18:
    print("Adult")
else:
    print("Minor")
```

## 7.3 if, elif and else

```python
score = 85

if score >= 90:
    print("A")
elif score >= 80:
    print("B")
elif score >= 70:
    print("C")
else:
    print("Fail")
```

## 7.4 Nested conditions

```python
username = "admin"
password = "1234"

if username == "admin":
    if password == "1234":
        print("Login successful")
    else:
        print("Wrong password")
else:
    print("Unknown username")
```

## 7.5 Ternary operator

A short conditional expression.

Syntax:

```python
value_if_true if condition else value_if_false
```

Example:

```python
age = 20

status = "Adult" if age >= 18 else "Minor"

print(status)
```

## 7.6 match-case

Python 3.10+ supports structural pattern matching.

```python
command = "start"

match command:
    case "start":
        print("Starting...")
    case "stop":
        print("Stopping...")
    case "restart":
        print("Restarting...")
    case _:
        print("Unknown command")
```

Matching values:

```python
status = 404

match status:
    case 200:
        print("OK")
    case 404:
        print("Not Found")
    case 500:
        print("Server Error")
    case _:
        print("Other status")
```

Matching multiple alternatives:

```python
match command:
    case "quit" | "exit":
        print("Closing program")
    case _:
        print("Continue")
```

---

# 8. LOOPS AND ITERATION

Loops repeat sections of code.

## 8.1 for loops

```python
for number in range(5):
    print(number)
```

Output:

```text
0
1
2
3
4
```

## 8.2 range()

Syntax:

```python
range(start, stop, step)
```

Examples:

```python
range(5)          # 0, 1, 2, 3, 4
range(1, 6)       # 1, 2, 3, 4, 5
range(0, 10, 2)   # 0, 2, 4, 6, 8
range(10, 0, -1)  # 10 down to 1
```

Example:

```python
for number in range(1, 11):
    print(number)
```

## 8.3 while loops

Repeats while a condition remains true.

```python
count = 0

while count < 5:
    print(count)
    count += 1
```

## 8.4 break

Immediately exits a loop.

```python
for number in range(10):
    if number == 5:
        break

    print(number)
```

## 8.5 continue

Skips the current iteration.

```python
for number in range(10):
    if number == 5:
        continue

    print(number)
```

## 8.6 pass

Does nothing. Useful as a placeholder.

```python
if True:
    pass
```

## 8.7 Nested loops

A loop inside another loop.

```python
for x in range(3):
    for y in range(3):
        print(x, y)
```

Useful for grids, matrices and simulations.

## 8.8 enumerate()

Provides an index and value while looping.

```python
fruits = ["Apple", "Banana", "Orange"]

for index, fruit in enumerate(fruits):
    print(index, fruit)
```

Start numbering at 1:

```python
for index, fruit in enumerate(fruits, start=1):
    print(index, fruit)
```

## 8.9 zip()

Loops through multiple collections simultaneously.

```python
names = ["Alex", "John", "Nathan"]
ages = [15, 16, 13]

for name, age in zip(names, ages):
    print(name, age)
```

## 8.10 Loop else

An `else` block executes when a loop finishes normally, not when it exits through `break`.

```python
for number in range(5):
    if number == 10:
        break
else:
    print("Loop completed normally")
```

---

# 9. LISTS

Lists store multiple values in an ordered, changeable collection.

## 9.1 Creating lists

```python
numbers = [1, 2, 3, 4, 5]
names = ["Alex", "Nathan", "John"]
mixed = [10, "Hello", True, 3.14]
empty = []
```

## 9.2 Accessing list elements

```python
numbers = [10, 20, 30, 40]

print(numbers[0])   # 10
print(numbers[-1])  # 40
```

## 9.3 Changing elements

```python
numbers = [10, 20, 30]

numbers[1] = 99

print(numbers)
```

## 9.4 List slicing

```python
numbers = [0, 1, 2, 3, 4, 5]

print(numbers[1:4])
print(numbers[:3])
print(numbers[2:])
print(numbers[::-1])
```

## 9.5 List methods

| Method | Purpose | Example |
|---|---|---|
| `.append(x)` | Add one element | `a.append(5)` |
| `.extend(iterable)` | Add multiple elements | `a.extend([5, 6])` |
| `.insert(i, x)` | Insert at position | `a.insert(0, 5)` |
| `.remove(x)` | Remove first matching value | `a.remove(5)` |
| `.pop(i)` | Remove and return element | `a.pop()` |
| `.clear()` | Remove everything | `a.clear()` |
| `.index(x)` | Find element position | `a.index(5)` |
| `.count(x)` | Count occurrences | `a.count(5)` |
| `.sort()` | Sort list in place | `a.sort()` |
| `.reverse()` | Reverse in place | `a.reverse()` |
| `.copy()` | Shallow copy | `b = a.copy()` |

Examples:

```python
numbers = [3, 1, 2]

numbers.append(4)
numbers.insert(0, 10)
numbers.remove(1)

print(numbers)
```

Sorting:

```python
numbers = [5, 2, 8, 1]

numbers.sort()

print(numbers)
```

Descending sorting:

```python
numbers.sort(reverse=True)
```

Using `sorted()` without changing the original:

```python
numbers = [5, 2, 8]

new_list = sorted(numbers)

print(new_list)
print(numbers)
```

## 9.6 Copying lists

Be careful with references.

```python
a = [1, 2, 3]
b = a

b.append(4)

print(a)  # [1, 2, 3, 4]
```

Both variables refer to the same list.

Create a shallow copy:

```python
b = a.copy()
```

Or:

```python
b = a[:]
```

For nested lists, use `copy.deepcopy()` when an independent deep copy is needed.

## 9.7 Nested lists

```python
matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
]

print(matrix[0][0])  # 1
print(matrix[1][2])  # 6
```

Loop through a matrix:

```python
for row in matrix:
    for value in row:
        print(value)
```

---

# 10. TUPLES

Tuples are ordered collections that cannot be modified after creation.

```python
coordinates = (10, 20)
```

Accessing elements:

```python
print(coordinates[0])
```

Single-element tuple:

```python
value = (10,)
```

Tuple unpacking:

```python
person = ("Nathan", 13, "Singapore")

name, age, country = person

print(name)
```

Tuple methods:

```python
numbers = (1, 2, 2, 3)

print(numbers.count(2))
print(numbers.index(3))
```

Converting between lists and tuples:

```python
my_list = [1, 2, 3]
my_tuple = tuple(my_list)

back_to_list = list(my_tuple)
```

Use tuples for fixed collections of values.

---

# 11. SETS

Sets store unique values and do not guarantee positional indexing.

## 11.1 Creating sets

```python
numbers = {1, 2, 3, 4}
empty_set = set()
```

Duplicate values are automatically removed:

```python
numbers = {1, 2, 2, 3}

print(numbers)
```

## 11.2 Set methods

```python
numbers = {1, 2, 3}

numbers.add(4)
numbers.update([5, 6])
numbers.remove(2)
numbers.discard(10)
```

Difference between `remove()` and `discard()`:

- `remove()` raises `KeyError` if the item is missing.
- `discard()` does not.

Other methods:

```python
numbers.pop()      # Removes and returns an arbitrary element
numbers.clear()    # Empties the set
```

## 11.3 Set operations

Given:

```python
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
```

Union:

```python
print(a | b)
print(a.union(b))
```

Intersection:

```python
print(a & b)
print(a.intersection(b))
```

Difference:

```python
print(a - b)
```

Symmetric difference:

```python
print(a ^ b)
```

Subset:

```python
print({1, 2}.issubset(a))
```

Superset:

```python
print(a.issuperset({1, 2}))
```

Disjoint:

```python
print({1, 2}.isdisjoint({3, 4}))
```

## 11.4 Frozensets

An immutable set.

```python
numbers = frozenset([1, 2, 3])
```

You cannot add or remove elements from a frozenset.

---

# 12. DICTIONARIES

Dictionaries store information using key-value pairs.

## 12.1 Creating dictionaries

```python
person = {
    "name": "Nathan",
    "age": 13,
    "country": "Singapore"
}
```

## 12.2 Accessing values

```python
print(person["name"])
print(person["age"])
```

Using `.get()`:

```python
print(person.get("name"))
print(person.get("height", "Unknown"))
```

`.get()` avoids a `KeyError` when the key does not exist.

## 12.3 Changing values

```python
person["age"] = 14
person["school"] = "BPGHS"
```

## 12.4 Dictionary methods

| Method | Purpose |
|---|---|
| `.keys()` | Return dictionary keys |
| `.values()` | Return dictionary values |
| `.items()` | Return key-value pairs |
| `.get(key)` | Safely retrieve value |
| `.update()` | Add or update entries |
| `.pop(key)` | Remove key and return value |
| `.popitem()` | Remove last inserted pair |
| `.clear()` | Empty dictionary |
| `.copy()` | Shallow copy |
| `.setdefault()` | Retrieve key or insert default |

Examples:

```python
person = {
    "name": "Nathan",
    "age": 13
}

print(person.keys())
print(person.values())
print(person.items())
```

Update:

```python
person.update({
    "age": 14,
    "city": "Singapore"
})
```

## 12.5 Looping through dictionaries

Keys:

```python
for key in person:
    print(key)
```

Values:

```python
for value in person.values():
    print(value)
```

Both:

```python
for key, value in person.items():
    print(key, value)
```

## 12.6 Nested dictionaries

```python
students = {
    "student1": {
        "name": "Alex",
        "age": 15
    },
    "student2": {
        "name": "Nathan",
        "age": 13
    }
}

print(students["student2"]["name"])
```

---

# 13. FUNCTIONS

Functions are reusable blocks of code.

## 13.1 Creating functions

Syntax:

```python
def function_name():
    # Code
    pass
```

Example:

```python
def greet():
    print("Hello!")

greet()
```

## 13.2 Function parameters

```python
def greet(name):
    print(f"Hello, {name}!")

greet("Nathan")
```

## 13.3 Multiple parameters

```python
def add(a, b):
    print(a + b)

add(10, 20)
```

## 13.4 Return values

`return` sends a value back to the caller.

```python
def add(a, b):
    return a + b

result = add(10, 20)

print(result)
```

Difference:

- `print()` displays information.
- `return` gives a value back to the calling code.

## 13.5 Default parameters

```python
def greet(name="Guest"):
    print(f"Hello {name}")

greet()
greet("Nathan")
```

## 13.6 Keyword arguments

```python
def introduce(name, age):
    print(name, age)

introduce(age=13, name="Nathan")
```

## 13.7 Positional arguments

```python
def subtract(a, b):
    return a - b

print(subtract(10, 3))
```

The argument order matters.

## 13.8 *args

Accepts any number of positional arguments.

```python
def add_all(*numbers):
    return sum(numbers)

print(add_all(1, 2, 3, 4, 5))
```

Inside the function, `numbers` is a tuple.

## 13.9 **kwargs

Accepts any number of keyword arguments.

```python
def show_info(**details):
    for key, value in details.items():
        print(key, value)

show_info(name="Nathan", age=13, country="Singapore")
```

Inside the function, `details` is a dictionary.

## 13.10 Combining arguments

```python
def example(a, b, *args, **kwargs):
    print(a)
    print(b)
    print(args)
    print(kwargs)

example(1, 2, 3, 4, name="Nathan")
```

## 13.11 Unpacking arguments

```python
def add(a, b, c):
    return a + b + c

numbers = [1, 2, 3]

print(add(*numbers))
```

Dictionary unpacking:

```python
def introduce(name, age):
    print(name, age)

data = {
    "name": "Nathan",
    "age": 13
}

introduce(**data)
```

## 13.12 Recursion

A function calling itself.

```python
def factorial(n):
    if n <= 1:
        return 1

    return n * factorial(n - 1)

print(factorial(5))
```

Output:

```text
120
```

Always provide a base case to prevent infinite recursion.

---

# 14. LAMBDA FUNCTIONS

Lambda functions are small anonymous functions.

Syntax:

```python
lambda arguments: expression
```

Example:

```python
square = lambda x: x ** 2

print(square(5))
```

Multiple arguments:

```python
add = lambda a, b: a + b

print(add(5, 10))
```

Using lambda with `sorted()`:

```python
students = [
    ("Alex", 80),
    ("Nathan", 95),
    ("John", 70)
]

students.sort(key=lambda student: student[1])

print(students)
```

Lambda with `map()`:

```python
numbers = [1, 2, 3]

result = list(map(lambda x: x * 2, numbers))

print(result)
```

Lambda with `filter()`:

```python
numbers = [1, 2, 3, 4, 5, 6]

result = list(filter(lambda x: x % 2 == 0, numbers))

print(result)
```

Use normal `def` functions when logic becomes complicated.

---

# 15. COMPREHENSIONS

Comprehensions create collections using concise syntax.

## 15.1 List comprehensions

Normal approach:

```python
squares = []

for number in range(10):
    squares.append(number ** 2)
```

Comprehension:

```python
squares = [number ** 2 for number in range(10)]
```

With conditions:

```python
even = [x for x in range(20) if x % 2 == 0]
```

With conditional expressions:

```python
labels = ["Even" if x % 2 == 0 else "Odd" for x in range(5)]
```

## 15.2 Dictionary comprehensions

```python
squares = {
    x: x ** 2
    for x in range(5)
}
```

Output:

```python
{
    0: 0,
    1: 1,
    2: 4,
    3: 9,
    4: 16
}
```

## 15.3 Set comprehensions

```python
squares = {x ** 2 for x in range(10)}
```

## 15.4 Nested comprehensions

```python
matrix = [[x * y for x in range(3)] for y in range(3)]
```

## 15.5 Generator expressions

```python
numbers = (x ** 2 for x in range(10))

for number in numbers:
    print(number)
```

Generator expressions produce values as needed instead of immediately creating a complete list.

---

# 16. ERROR HANDLING AND EXCEPTIONS

Errors can interrupt programs. Exception handling allows you to respond to them.

## 16.1 try and except

```python
try:
    number = int(input("Enter a number: "))
    print(number)

except ValueError:
    print("Invalid number!")
```

## 16.2 Multiple exceptions

```python
try:
    number = int(input("Enter number: "))
    result = 10 / number

except ValueError:
    print("Please enter a valid integer.")

except ZeroDivisionError:
    print("Cannot divide by zero.")
```

## 16.3 Catching multiple exception types

```python
try:
    result = 10 / int("0")

except (ValueError, ZeroDivisionError):
    print("An error occurred.")
```

## 16.4 Generic exception handling

```python
try:
    print(10 / 0)

except Exception as error:
    print(f"Error: {error}")
```

Avoid catching every exception without a good reason.

## 16.5 else

Runs when no exception occurs.

```python
try:
    number = int("100")

except ValueError:
    print("Invalid")

else:
    print("Conversion successful")
```

## 16.6 finally

Always executes, whether an exception occurred or not.

```python
try:
    print("Running")

finally:
    print("Cleanup complete")
```

## 16.7 raise

Manually trigger an exception.

```python
age = -5

if age < 0:
    raise ValueError("Age cannot be negative")
```

## 16.8 Creating custom exceptions

```python
class LoginError(Exception):
    pass


def login(password):
    if password != "1234":
        raise LoginError("Incorrect password")


try:
    login("wrong")

except LoginError as error:
    print(error)
```

## 16.9 assert

Checks whether a condition is true.

```python
age = 20

assert age >= 0, "Age cannot be negative"
```

Assertions can be disabled with Python optimisation flags, so do not use them for essential input validation.

---

# 17. FILE HANDLING

Python can create, read, modify and delete files.

## 17.1 Opening files

Syntax:

```python
open(filename, mode)
```

File modes:

| Mode | Meaning |
|---|---|
| `r` | Read |
| `w` | Write, overwrites existing contents |
| `a` | Append |
| `x` | Create, fails if already exists |
| `b` | Binary mode |
| `t` | Text mode |
| `+` | Reading and writing |

## 17.2 Reading files

```python
file = open("data.txt", "r")

content = file.read()

print(content)

file.close()
```

Read one line:

```python
file = open("data.txt", "r")

line = file.readline()

print(line)

file.close()
```

Read all lines:

```python
with open("data.txt", "r") as file:
    lines = file.readlines()

print(lines)
```

## 17.3 Writing files

```python
with open("data.txt", "w") as file:
    file.write("Hello World")
```

Warning: `w` overwrites existing content.

## 17.4 Appending files

```python
with open("data.txt", "a") as file:
    file.write("\nNew line")
```

## 17.5 Writing multiple lines

```python
lines = ["Apple\n", "Banana\n", "Orange\n"]

with open("fruits.txt", "w") as file:
    file.writelines(lines)
```

## 17.6 Reading binary files

Useful for images, audio and other binary data.

```python
with open("image.png", "rb") as file:
    data = file.read()
```

## 17.7 Writing binary files

```python
with open("copy.png", "wb") as file:
    file.write(data)
```

## 17.8 File positioning

```python
with open("data.txt", "r") as file:
    print(file.tell())

    file.seek(5)

    print(file.read())
```

- `tell()` returns the current position.
- `seek()` changes the position.

## 17.9 Encoding

```python
with open("data.txt", "r", encoding="utf-8") as file:
    content = file.read()
```

UTF-8 is a common encoding for text files.

---

# 18. MODULES AND IMPORTS

Modules allow you to organise code and reuse existing functionality.

## 18.1 Importing a module

```python
import math

print(math.sqrt(25))
```

## 18.2 Importing specific functions

```python
from math import sqrt, pi

print(sqrt(25))
print(pi)
```

## 18.3 Import aliases

```python
import math as m

print(m.sqrt(16))
```

## 18.4 Import everything

```python
from math import *
```

This is generally discouraged because it can create naming conflicts.

## 18.5 Creating your own module

Create `calculator.py`:

```python
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
```

Create `main.py`:

```python
import calculator

print(calculator.add(10, 5))
```

## 18.6 The main guard

```python
def main():
    print("Program started")


if __name__ == "__main__":
    main()
```

This ensures `main()` runs when the file is executed directly, but not when it is imported as a module.

---

# 19. OBJECT-ORIENTED PROGRAMMING (OOP)

OOP organises programs around objects and classes.

## 19.1 Classes

A class is a blueprint for creating objects.

```python
class Person:
    pass
```

Creating an object:

```python
person1 = Person()
```

## 19.2 Attributes

Attributes store information about objects.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("Nathan", 13)

print(person.name)
print(person.age)
```

## 19.3 Methods

Methods are functions defined inside classes.

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        print(f"Hello, I am {self.name}")


person = Person("Nathan")

person.greet()
```

## 19.4 The self parameter

`self` refers to the current object.

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        print(self.name, "is barking")
```

## 19.5 Class attributes

Shared by instances unless overridden.

```python
class Student:
    school = "BPGHS"

    def __init__(self, name):
        self.name = name


a = Student("Alex")
b = Student("Nathan")

print(a.school)
print(b.school)
```

## 19.6 Instance attributes

Belong to individual objects.

```python
class Player:
    def __init__(self, health):
        self.health = health


player1 = Player(100)
player2 = Player(50)
```

## 19.7 Instance methods

Operate on an object using `self`.

```python
class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1
```

## 19.8 Class methods

Use `@classmethod` and receive the class as `cls`.

```python
class Person:
    count = 0

    def __init__(self):
        Person.count += 1

    @classmethod
    def get_count(cls):
        return cls.count


Person()

print(Person.get_count())
```

## 19.9 Static methods

Do not automatically receive `self` or `cls`.

```python
class Calculator:
    @staticmethod
    def add(a, b):
        return a + b


print(Calculator.add(10, 20))
```

## 19.10 Encapsulation

Encapsulation groups data and methods together and controls access through conventions and properties.

Python naming conventions:

```python
class BankAccount:
    def __init__(self, balance):
        self.balance = balance
        self._internal_code = "ABC"
        self.__secret = "hidden"
```

- `balance`: public.
- `_internal_code`: intended for internal use by convention.
- `__secret`: name-mangled to reduce accidental access.

Double underscores do not provide true security.

## 19.11 Properties

Properties allow methods to be accessed like attributes.

```python
class Person:
    def __init__(self, age):
        self._age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value < 0:
            raise ValueError("Invalid age")

        self._age = value


person = Person(13)

print(person.age)

person.age = 14
```

---

# 20. INHERITANCE AND POLYMORPHISM

## 20.1 Inheritance

A class can inherit functionality from another class.

```python
class Animal:
    def speak(self):
        print("Animal sound")


class Dog(Animal):
    pass


dog = Dog()
dog.speak()
```

## 20.2 Overriding methods

```python
class Animal:
    def speak(self):
        print("Generic sound")


class Dog(Animal):
    def speak(self):
        print("Woof!")


dog = Dog()
dog.speak()
```

## 20.3 super()

Calls functionality from a parent class.

```python
class Animal:
    def __init__(self, name):
        self.name = name


class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)
        self.breed = breed


dog = Dog("Buddy", "Golden Retriever")
```

## 20.4 Multiple inheritance

A class can inherit from multiple parent classes.

```python
class Flyer:
    def fly(self):
        print("Flying")


class Swimmer:
    def swim(self):
        print("Swimming")


class Duck(Flyer, Swimmer):
    pass


duck = Duck()

duck.fly()
duck.swim()
```

## 20.5 Polymorphism

Different objects can implement the same method differently.

```python
class Dog:
    def speak(self):
        print("Woof")


class Cat:
    def speak(self):
        print("Meow")


animals = [Dog(), Cat()]

for animal in animals:
    animal.speak()
```

## 20.6 Abstract classes

Use the `abc` module to define interfaces that subclasses must implement.

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        pass


class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side ** 2


square = Square(5)

print(square.area())
```

## 20.7 Dataclasses

Dataclasses automatically generate useful methods such as `__init__()` and `__repr__()`.

```python
from dataclasses import dataclass


@dataclass
class Student:
    name: str
    age: int


student = Student("Nathan", 13)

print(student)
```

---

# 21. ADVANCED FUNCTIONS

## 21.1 First-class functions

Functions can be stored in variables and passed to other functions.

```python
def greet():
    print("Hello")


function = greet

function()
```

## 21.2 Functions as arguments

```python
def greet():
    return "Hello"


def display(function):
    print(function())


display(greet)
```

## 21.3 Returning functions

```python
def outer():
    def inner():
        print("Inside inner function")

    return inner


function = outer()
function()
```

## 21.4 Closures

A closure remembers variables from its enclosing function.

```python
def multiplier(number):
    def multiply(value):
        return value * number

    return multiply


double = multiplier(2)

print(double(10))
```

## 21.5 Nonlocal

Changes a variable in the nearest enclosing function scope.

```python
def counter():
    count = 0

    def increment():
        nonlocal count
        count += 1
        return count

    return increment


c = counter()

print(c())
print(c())
```

## 21.6 Global

Access or modify a module-level variable.

```python
count = 0


def increment():
    global count
    count += 1


increment()

print(count)
```

Use global variables sparingly.

---

# 22. ITERATORS AND GENERATORS

## 22.1 Iterables

An iterable is an object that can be looped over.

Examples:
- Lists
- Tuples
- Strings
- Dictionaries
- Sets
- Files
- Ranges

```python
for character in "Python":
    print(character)
```

## 22.2 Iterators

An iterator produces values one at a time.

```python
numbers = [1, 2, 3]

iterator = iter(numbers)

print(next(iterator))
print(next(iterator))
print(next(iterator))
```

Calling `next()` after the iterator is exhausted raises `StopIteration`.

## 22.3 Creating custom iterators

```python
class Counter:
    def __init__(self, limit):
        self.current = 0
        self.limit = limit

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.limit:
            raise StopIteration

        self.current += 1
        return self.current


for number in Counter(5):
    print(number)
```

## 22.4 Generators

Generators use `yield` to produce values one at a time.

```python
def generate_numbers():
    yield 1
    yield 2
    yield 3


for number in generate_numbers():
    print(number)
```

## 22.5 Generator with a loop

```python
def count_to(limit):
    for number in range(1, limit + 1):
        yield number


for number in count_to(5):
    print(number)
```

## 22.6 yield from

Delegates generation to another iterable.

```python
def numbers():
    yield from [1, 2, 3]


print(list(numbers()))
```

Generators are useful for large datasets because they avoid storing every generated value in memory.

---

# 23. DECORATORS

Decorators modify or wrap the behaviour of functions.

## 23.1 Basic decorator

```python
def decorator(function):
    def wrapper():
        print("Before function")
        function()
        print("After function")

    return wrapper


@decorator
def greet():
    print("Hello")


greet()
```

Output:

```text
Before function
Hello
After function
```

## 23.2 Decorator with arguments

```python
from functools import wraps


def decorator(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        print("Running function")

        return function(*args, **kwargs)

    return wrapper


@decorator
def add(a, b):
    return a + b


print(add(10, 20))
```

## 23.3 Decorators with parameters

```python
def repeat(times):
    def decorator(function):
        def wrapper(*args, **kwargs):
            for _ in range(times):
                function(*args, **kwargs)

        return wrapper

    return decorator


@repeat(3)
def greet():
    print("Hello")


greet()
```

Common uses:
- Logging
- Timing functions
- Authentication checks
- Caching
- Access control
- Validation

---

# 24. CONTEXT MANAGERS

Context managers manage resources and automatically perform cleanup.

## 24.1 with statement

```python
with open("data.txt", "r") as file:
    content = file.read()
```

The file is automatically closed when the block finishes.

## 24.2 Creating a context manager

```python
class MyContext:
    def __enter__(self):
        print("Entering")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        print("Exiting")
        return False


with MyContext():
    print("Inside context")
```

## 24.3 Using contextlib

```python
from contextlib import contextmanager


@contextmanager
def my_context():
    print("Start")

    try:
        yield
    finally:
        print("End")


with my_context():
    print("Working")
```

---

# 25. REGULAR EXPRESSIONS

Regular expressions (regex) are used to search, match and manipulate text patterns.

Import:

```python
import re
```

## 25.1 Common regex symbols

| Symbol | Meaning |
|---|---|
| `.` | Any character except newline by default |
| `^` | Beginning of string/line |
| `$` | End of string/line |
| `*` | Zero or more |
| `+` | One or more |
| `?` | Zero or one |
| `{n}` | Exactly n repetitions |
| `{n,m}` | Between n and m repetitions |
| `[]` | Character set |
| `[^]` | Negated character set |
| `\d` | Digit |
| `\D` | Non-digit |
| `\w` | Word character |
| `\W` | Non-word character |
| `\s` | Whitespace |
| `\S` | Non-whitespace |
| `()` | Capturing group |
| `|` | OR |
| `\b` | Word boundary |

## 25.2 re.search()

Finds the first matching pattern.

```python
import re

text = "My number is 12345"

result = re.search(r"\d+", text)

if result:
    print(result.group())
```

## 25.3 re.match()

Checks for a match at the beginning of a string.

```python
result = re.match(r"Hello", "Hello World")

print(result.group() if result else "No match")
```

## 25.4 re.findall()

Returns all matches.

```python
text = "12 apples and 25 oranges"

numbers = re.findall(r"\d+", text)

print(numbers)
```

## 25.5 re.sub()

Replaces matching text.

```python
text = "Hello 123"

result = re.sub(r"\d+", "456", text)

print(result)
```

## 25.6 re.split()

Splits using a pattern.

```python
text = "apple,banana;orange"

result = re.split(r"[,;]", text)

print(result)
```

## 25.7 Compiling regex

```python
pattern = re.compile(r"\d+")

print(pattern.findall("123 abc 456"))
```

---

# 26. WORKING WITH DATES AND TIME

Use the `datetime` module.

```python
import datetime
```

## 26.1 Current date and time

```python
now = datetime.datetime.now()

print(now)
```

## 26.2 Current date

```python
today = datetime.date.today()

print(today)
```

## 26.3 Creating dates

```python
date = datetime.date(2026, 11, 7)

print(date)
```

## 26.4 Creating times

```python
time = datetime.time(14, 30, 0)

print(time)
```

## 26.5 Formatting dates

```python
now = datetime.datetime.now()

print(now.strftime("%d/%m/%Y"))
print(now.strftime("%H:%M:%S"))
print(now.strftime("%A"))
```

Common formatting codes:

| Code | Meaning |
|---|---|
| `%Y` | Four-digit year |
| `%y` | Two-digit year |
| `%m` | Month number |
| `%B` | Full month name |
| `%b` | Abbreviated month |
| `%d` | Day |
| `%A` | Full weekday |
| `%a` | Abbreviated weekday |
| `%H` | 24-hour clock |
| `%I` | 12-hour clock |
| `%M` | Minute |
| `%S` | Second |
| `%p` | AM/PM |

## 26.6 Parsing dates

```python
date_string = "07/11/2026"

date = datetime.datetime.strptime(
    date_string,
    "%d/%m/%Y"
)

print(date)
```

## 26.7 Time differences

```python
from datetime import datetime, timedelta

now = datetime.now()

tomorrow = now + timedelta(days=1)

print(tomorrow)
```

Subtracting dates:

```python
difference = tomorrow - now

print(difference.days)
```

---

# 27. MATHEMATICAL OPERATIONS

## 27.1 Built-in mathematical functions

```python
abs(-10)       # 10
round(3.14159, 2)  # 3.14
pow(2, 3)      # 8
sum([1, 2, 3]) # 6
min([1, 2, 3]) # 1
max([1, 2, 3]) # 3
```

## 27.2 Math module

```python
import math
```

Common functions:

| Function | Purpose |
|---|---|
| `math.sqrt(x)` | Square root |
| `math.pow(x, y)` | Power |
| `math.floor(x)` | Round down |
| `math.ceil(x)` | Round up |
| `math.factorial(x)` | Factorial |
| `math.gcd(a, b)` | Greatest common divisor |
| `math.lcm(a, b)` | Least common multiple |
| `math.fabs(x)` | Absolute floating-point value |
| `math.trunc(x)` | Remove decimal portion |
| `math.sin(x)` | Sine |
| `math.cos(x)` | Cosine |
| `math.tan(x)` | Tangent |
| `math.log(x)` | Natural logarithm |
| `math.log10(x)` | Base-10 logarithm |
| `math.exp(x)` | e raised to x |
| `math.isqrt(x)` | Integer square root |
| `math.isfinite(x)` | Check finite number |
| `math.isinf(x)` | Check infinity |
| `math.isnan(x)` | Check NaN |

Examples:

```python
import math

print(math.sqrt(144))
print(math.ceil(4.2))
print(math.floor(4.9))
print(math.factorial(5))
print(math.gcd(24, 36))
```

Constants:

```python
print(math.pi)
print(math.e)
print(math.tau)
```

---

# 28. RANDOMISATION

Use the `random` module.

```python
import random
```

## 28.1 Random integer

```python
number = random.randint(1, 100)
```

Both endpoints are included.

## 28.2 Random floating-point number

```python
number = random.random()
```

Returns a value from 0.0 up to, but not including, 1.0.

## 28.3 Random choice

```python
items = ["Apple", "Banana", "Orange"]

print(random.choice(items))
```

## 28.4 Random sample

Select multiple unique elements:

```python
numbers = random.sample(range(100), 5)

print(numbers)
```

## 28.5 Shuffle

```python
cards = [1, 2, 3, 4, 5]

random.shuffle(cards)

print(cards)
```

## 28.6 Random seed

```python
random.seed(42)

print(random.randint(1, 100))
```

A fixed seed makes pseudorandom results reproducible.

For passwords, tokens and security-sensitive random values, use `secrets` instead:

```python
import secrets

token = secrets.token_hex(16)
password_number = secrets.randbelow(100)
```

---

# 29. WORKING WITH JSON

JSON is a common format for storing and transferring data.

Import:

```python
import json
```

## 29.1 Python dictionary to JSON string

```python
data = {
    "name": "Nathan",
    "age": 13
}

json_data = json.dumps(data)

print(json_data)
```

## 29.2 Pretty JSON

```python
json_data = json.dumps(data, indent=4)

print(json_data)
```

## 29.3 JSON string to Python object

```python
json_string = '{"name": "Nathan", "age": 13}'

data = json.loads(json_string)

print(data["name"])
```

## 29.4 Saving JSON to a file

```python
with open("data.json", "w", encoding="utf-8") as file:
    json.dump(data, file, indent=4)
```

## 29.5 Loading JSON from a file

```python
with open("data.json", "r", encoding="utf-8") as file:
    data = json.load(file)

print(data)
```

Difference:

- `dump()` writes JSON into a file.
- `dumps()` creates a JSON string.
- `load()` reads JSON from a file.
- `loads()` reads JSON from a string.

---

# 30. WORKING WITH CSV

CSV stands for Comma-Separated Values.

Import:

```python
import csv
```

## 30.1 Reading CSV

```python
with open("students.csv", "r", newline="", encoding="utf-8") as file:
    reader = csv.reader(file)

    for row in reader:
        print(row)
```

## 30.2 Writing CSV

```python
with open("students.csv", "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)

    writer.writerow(["Name", "Age"])
    writer.writerow(["Nathan", 13])
    writer.writerow(["Alex", 15])
```

## 30.3 Dictionary-based CSV

```python
with open("students.csv", "w", newline="", encoding="utf-8") as file:
    fields = ["name", "age"]

    writer = csv.DictWriter(file, fieldnames=fields)

    writer.writeheader()

    writer.writerow({
        "name": "Nathan",
        "age": 13
    })
```

Reading dictionaries:

```python
with open("students.csv", "r", newline="", encoding="utf-8") as file:
    reader = csv.DictReader(file)

    for row in reader:
        print(row["name"])
```

---

# 31. OPERATING SYSTEM INTERACTION

The `os` module interacts with the operating system.

```python
import os
```

## 31.1 Current directory

```python
print(os.getcwd())
```

## 31.2 Change directory

```python
os.chdir("C:/Users/Nathan/Documents")
```

## 31.3 List directory contents

```python
files = os.listdir(".")

print(files)
```

## 31.4 Create directory

```python
os.mkdir("NewFolder")
```

Create nested directories:

```python
os.makedirs("Folder/Subfolder", exist_ok=True)
```

## 31.5 Delete directories

```python
os.rmdir("NewFolder")
```

For non-empty directories:

```python
import shutil

shutil.rmtree("Folder")
```

Be careful: `rmtree()` permanently removes the directory tree.

## 31.6 Rename files

```python
os.rename("old.txt", "new.txt")
```

## 31.7 Delete files

```python
os.remove("file.txt")
```

## 31.8 Environment variables

```python
print(os.environ.get("PATH"))
```

Set an environment variable for the current process:

```python
os.environ["MY_VARIABLE"] = "Hello"
```

## 31.9 Paths

Prefer `pathlib` for modern path handling.

```python
from pathlib import Path

path = Path("Documents") / "data.txt"

print(path)
print(path.exists())
print(path.name)
print(path.stem)
print(path.suffix)
print(path.parent)
```

Creating a folder:

```python
Path("NewFolder").mkdir(exist_ok=True)
```

Reading a text file:

```python
path = Path("data.txt")

content = path.read_text(encoding="utf-8")
```

Writing a text file:

```python
path.write_text("Hello", encoding="utf-8")
```

---

# 32. SYSTEM COMMANDS AND SUBPROCESS

Python can execute external programs using `subprocess`.

## 32.1 Running a system command

```python
import subprocess

subprocess.run(["python", "--version"])
```

## 32.2 Capturing output

```python
result = subprocess.run(
    ["python", "--version"],
    capture_output=True,
    text=True
)

print(result.stdout)
print(result.stderr)
```

## 32.3 Checking exit status

```python
result = subprocess.run(["python", "--version"])

print(result.returncode)
```

Usually, `0` means success.

## 32.4 Raising errors on failure

```python
subprocess.run(
    ["python", "--version"],
    check=True
)
```

## 32.5 Running a process and waiting

```python
process = subprocess.Popen(["python", "--version"])

process.wait()
```

Use argument lists rather than constructing shell command strings whenever possible. Avoid `shell=True` with untrusted input.

---

# 33. NETWORKING AND INTERNET ACCESS

Python can communicate with servers and access online resources.

## 33.1 urllib

Built-in module:

```python
from urllib.request import urlopen

with urlopen("https://example.com") as response:
    html = response.read().decode("utf-8")

print(html)
```

## 33.2 Requests library

Install:

```bash
pip install requests
```

GET request:

```python
import requests

response = requests.get("https://example.com", timeout=10)

print(response.status_code)
print(response.text)
```

JSON API request:

```python
response = requests.get(
    "https://api.github.com",
    timeout=10
)

data = response.json()

print(data)
```

POST request:

```python
response = requests.post(
    "https://httpbin.org/post",
    json={"name": "Nathan"},
    timeout=10
)

print(response.status_code)
```

HTTP methods:

| Method | Purpose |
|---|---|
| GET | Retrieve information |
| POST | Submit information |
| PUT | Replace a resource |
| PATCH | Partially update a resource |
| DELETE | Delete a resource |
| HEAD | Retrieve response headers |
| OPTIONS | Check supported operations |

## 33.3 Basic socket programming

```python
import socket

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

client.connect(("example.com", 80))

client.sendall(
    b"GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n"
)

response = client.recv(4096)

print(response.decode(errors="replace"))

client.close()
```

Sockets are lower-level networking tools. Production applications should also handle timeouts, connection errors and partial reads.

---

# 34. MULTITHREADING AND MULTIPROCESSING

These techniques allow programs to perform multiple tasks.

## 34.1 Threading

Useful for I/O-bound tasks.

```python
import threading


def task():
    print("Task running")


thread = threading.Thread(target=task)

thread.start()
thread.join()

print("Finished")
```

## 34.2 Multiple threads

```python
import threading
import time


def worker(number):
    print(f"Worker {number} started")
    time.sleep(1)
    print(f"Worker {number} finished")


threads = []

for i in range(5):
    thread = threading.Thread(target=worker, args=(i,))
    threads.append(thread)
    thread.start()

for thread in threads:
    thread.join()
```

## 34.3 Locks

Locks prevent multiple threads from modifying shared data simultaneously.

```python
import threading

lock = threading.Lock()

counter = 0


def increment():
    global counter

    for _ in range(1000):
        with lock:
            counter += 1
```

## 34.4 Multiprocessing

Useful for CPU-intensive work.

```python
from multiprocessing import Process


def task():
    print("Process running")


if __name__ == "__main__":
    process = Process(target=task)

    process.start()
    process.join()
```

On platforms that use process spawning, including Windows, protect process creation with the main guard.

## 34.5 ThreadPoolExecutor

```python
from concurrent.futures import ThreadPoolExecutor


def square(number):
    return number ** 2


with ThreadPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(square, range(10)))

print(results)
```

## 34.6 ProcessPoolExecutor

```python
from concurrent.futures import ProcessPoolExecutor


def square(number):
    return number ** 2


if __name__ == "__main__":
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(square, range(10)))

    print(results)
```

---

# 35. ASYNCHRONOUS PROGRAMMING

Async programming allows a program to handle other tasks while waiting for operations to finish.

Use the `asyncio` module.

## 35.1 async and await

```python
import asyncio


async def greet():
    print("Hello")


asyncio.run(greet())
```

## 35.2 Sleeping asynchronously

```python
import asyncio


async def task():
    print("Starting")

    await asyncio.sleep(2)

    print("Finished")


asyncio.run(task())
```

Unlike `time.sleep()`, `asyncio.sleep()` allows other asynchronous tasks to run.

## 35.3 Running multiple tasks

```python
import asyncio


async def task(number):
    print(f"Task {number} started")

    await asyncio.sleep(2)

    print(f"Task {number} completed")


async def main():
    await asyncio.gather(
        task(1),
        task(2),
        task(3)
    )


asyncio.run(main())
```

## 35.4 Creating tasks

```python
async def main():
    task1 = asyncio.create_task(task(1))
    task2 = asyncio.create_task(task(2))

    await task1
    await task2
```

Async programming is especially useful for network requests, web servers and other I/O-heavy applications.

---

# 36. TYPE HINTS

Type hints describe the expected types of variables, parameters and return values.

Python does not generally enforce these annotations at runtime.

## 36.1 Basic type hints

```python
name: str = "Nathan"
age: int = 13
height: float = 1.65
active: bool = True
```

## 36.2 Function type hints

```python
def add(a: int, b: int) -> int:
    return a + b
```

## 36.3 Collection type hints

```python
numbers: list[int] = [1, 2, 3]

names: list[str] = ["Alex", "Nathan"]

scores: dict[str, int] = {
    "Nathan": 95
}
```

## 36.4 Optional values

Python 3.10+:

```python
def find_user(name: str) -> str | None:
    if name == "Nathan":
        return "Found"

    return None
```

## 36.5 Union types

```python
def display(value: int | str):
    print(value)
```

## 36.6 Type aliases

```python
Coordinates = tuple[float, float]

position: Coordinates = (10.5, 20.3)
```

## 36.7 Typed dictionaries

```python
from typing import TypedDict


class Student(TypedDict):
    name: str
    age: int


student: Student = {
    "name": "Nathan",
    "age": 13
}
```

## 36.8 Generic types

```python
from typing import TypeVar

T = TypeVar("T")


def first(items: list[T]) -> T:
    return items[0]
```

---

# 37. DEBUGGING AND TESTING

## 37.1 print debugging

```python
number = 10

print("DEBUG:", number)
```

## 37.2 Using breakpoint()

```python
number = 10

breakpoint()

print(number)
```

Python enters the debugger at that point.

## 37.3 Using pdb

```python
import pdb

pdb.set_trace()
```

Useful debugger commands:

| Command | Purpose |
|---|---|
| `n` | Next line |
| `s` | Step into |
| `c` | Continue |
| `l` | Show source |
| `p variable` | Print variable |
| `q` | Quit debugger |
| `b` | Set breakpoint |

## 37.4 Logging

Use the `logging` module rather than excessive debug prints.

```python
import logging

logging.basicConfig(level=logging.DEBUG)

logging.debug("Debug message")
logging.info("Information")
logging.warning("Warning")
logging.error("Error")
logging.critical("Critical error")
```

Logging levels:

1. DEBUG
2. INFO
3. WARNING
4. ERROR
5. CRITICAL

## 37.5 Unit testing

```python
import unittest


def add(a, b):
    return a + b


class TestCalculator(unittest.TestCase):

    def test_add(self):
        self.assertEqual(add(2, 3), 5)

    def test_negative(self):
        self.assertEqual(add(-2, 2), 0)


if __name__ == "__main__":
    unittest.main()
```

## 37.6 Common unittest assertions

| Assertion | Purpose |
|---|---|
| `assertEqual(a, b)` | Values equal |
| `assertNotEqual(a, b)` | Values differ |
| `assertTrue(x)` | Condition true |
| `assertFalse(x)` | Condition false |
| `assertIsNone(x)` | Value is None |
| `assertIn(a, b)` | Value exists |
| `assertRaises(Error)` | Exception expected |
| `assertGreater(a, b)` | First value greater |
| `assertLess(a, b)` | First value smaller |

## 37.7 pytest

Install:

```bash
pip install pytest
```

Example:

```python
def add(a, b):
    return a + b


def test_add():
    assert add(2, 3) == 5
```

Run:

```bash
pytest
```

---

# 38. VIRTUAL ENVIRONMENTS AND PIP

Virtual environments keep project dependencies separate.

## 38.1 Checking Python version

```bash
python --version
```

Depending on your system:

```bash
python3 --version
```

## 38.2 Installing packages

```bash
pip install requests
```

Or:

```bash
python -m pip install requests
```

## 38.3 Updating packages

```bash
python -m pip install --upgrade requests
```

## 38.4 Uninstalling packages

```bash
pip uninstall requests
```

## 38.5 Listing installed packages

```bash
pip list
```

## 38.6 Package information

```bash
pip show requests
```

## 38.7 Saving dependencies

```bash
pip freeze > requirements.txt
```

## 38.8 Installing dependencies from a file

```bash
pip install -r requirements.txt
```

## 38.9 Creating a virtual environment

```bash
python -m venv venv
```

## 38.10 Activating it

Windows CMD:

```bash
venv\Scripts\activate
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source venv/bin/activate
```

## 38.11 Deactivating

```bash
deactivate
```

---

# 39. USEFUL BUILT-IN FUNCTIONS

Python includes many useful functions without requiring additional imports.

| Function | Purpose | Example |
|---|---|---|
| `print()` | Display output | `print("Hello")` |
| `input()` | Receive input | `input("Name: ")` |
| `len()` | Get length | `len("Python")` |
| `type()` | Check type | `type(10)` |
| `isinstance()` | Check instance type | `isinstance(10, int)` |
| `int()` | Convert to integer | `int("10")` |
| `float()` | Convert to float | `float("3.5")` |
| `str()` | Convert to string | `str(10)` |
| `bool()` | Convert to Boolean | `bool(1)` |
| `list()` | Create list | `list("abc")` |
| `tuple()` | Create tuple | `tuple([1, 2])` |
| `set()` | Create set | `set([1, 1, 2])` |
| `dict()` | Create dictionary | `dict(a=1)` |
| `range()` | Generate integer sequence | `range(10)` |
| `enumerate()` | Generate index-value pairs | `enumerate(["a","b"])` |
| `zip()` | Combine iterables | `zip(a, b)` |
| `sorted()` | Return sorted list | `sorted([3,1,2])` |
| `reversed()` | Reverse iterator | `reversed([1,2,3])` |
| `sum()` | Add values | `sum([1,2,3])` |
| `min()` | Minimum | `min([1,2,3])` |
| `max()` | Maximum | `max([1,2,3])` |
| `abs()` | Absolute value | `abs(-5)` |
| `round()` | Round number | `round(3.14, 1)` |
| `pow()` | Exponentiation | `pow(2, 3)` |
| `divmod()` | Quotient and remainder | `divmod(10, 3)` |
| `all()` | All values truthy | `all([True, True])` |
| `any()` | At least one truthy | `any([False, True])` |
| `map()` | Transform iterable | `map(str, [1,2])` |
| `filter()` | Filter iterable | `filter(bool, values)` |
| `iter()` | Get iterator | `iter([1,2])` |
| `next()` | Get next iterator value | `next(iterator)` |
| `callable()` | Check if callable | `callable(print)` |
| `getattr()` | Retrieve attribute | `getattr(obj, "name")` |
| `setattr()` | Set attribute | `setattr(obj, "age", 13)` |
| `hasattr()` | Check attribute | `hasattr(obj, "name")` |
| `delattr()` | Delete attribute | `delattr(obj, "name")` |
| `dir()` | List available names | `dir(str)` |
| `help()` | Show documentation | `help(list)` |
| `id()` | Get object identity | `id(variable)` |
| `hash()` | Calculate hash | `hash("hello")` |
| `repr()` | Developer-oriented representation | `repr("hello")` |
| `format()` | Format value | `format(3.14, ".2f")` |
| `chr()` | Unicode code to character | `chr(65)` |
| `ord()` | Character to Unicode code | `ord("A")` |
| `bin()` | Binary representation | `bin(10)` |
| `oct()` | Octal representation | `oct(10)` |
| `hex()` | Hexadecimal representation | `hex(255)` |
| `ascii()` | ASCII-escaped representation | `ascii("é")` |
| `bytes()` | Create immutable bytes | `bytes([65, 66])` |
| `bytearray()` | Mutable byte sequence | `bytearray([65,66])` |
| `memoryview()` | View binary data | `memoryview(b"abc")` |
| `open()` | Open file | `open("data.txt")` |
| `eval()` | Evaluate expression | `eval("2 + 2")` |
| `exec()` | Execute Python code | `exec("print(2)")` |
| `compile()` | Compile source code | `compile("2+2", "<string>", "eval")` |
| `globals()` | Global namespace | `globals()` |
| `locals()` | Local namespace | `locals()` |
| `vars()` | Object namespace dictionary | `vars(obj)` |
| `super()` | Access parent-class functionality | `super()` |
| `property()` | Create managed property | `property()` |
| `staticmethod()` | Create static method | `staticmethod(func)` |
| `classmethod()` | Create class method | `classmethod(func)` |
| `object()` | Create base object | `object()` |
| `slice()` | Create slicing object | `slice(1, 5)` |
| `breakpoint()` | Start debugger | `breakpoint()` |

**Security warning:** Never use `eval()` or `exec()` with untrusted input. They can execute arbitrary Python code.

---

# 40. COMMON STANDARD LIBRARIES

These are included with Python and do not normally require pip installation.

## Mathematics and calculations

| Library | Purpose |
|---|---|
| `math` | Mathematical functions |
| `cmath` | Complex-number mathematics |
| `statistics` | Statistical calculations |
| `decimal` | Accurate decimal arithmetic |
| `fractions` | Fraction calculations |
| `random` | Pseudorandom values |
| `secrets` | Security-sensitive random values |

Example:

```python
from statistics import mean, median, mode

numbers = [10, 20, 20, 30, 40]

print(mean(numbers))
print(median(numbers))
print(mode(numbers))
```

## File and data management

| Library | Purpose |
|---|---|
| `os` | Operating system interaction |
| `pathlib` | Filesystem paths |
| `shutil` | File and directory operations |
| `glob` | File pattern matching |
| `tempfile` | Temporary files |
| `json` | JSON processing |
| `csv` | CSV processing |
| `pickle` | Python object serialisation |
| `sqlite3` | SQLite database |
| `configparser` | Configuration files |
| `zipfile` | ZIP archives |
| `tarfile` | TAR archives |
| `hashlib` | Cryptographic hashes |
| `hmac` | Message authentication |
| `base64` | Base64 encoding |

## System and development

| Library | Purpose |
|---|---|
| `sys` | Python interpreter information |
| `platform` | Operating system information |
| `subprocess` | External processes |
| `argparse` | Command-line arguments |
| `logging` | Logging |
| `traceback` | Error tracebacks |
| `inspect` | Inspect Python objects |
| `ast` | Parse Python syntax |
| `dis` | Python bytecode inspection |
| `gc` | Garbage collector |
| `timeit` | Performance measurement |
| `profile` | Performance profiling |
| `cProfile` | Deterministic profiling |

Example:

```python
import platform

print(platform.system())
print(platform.release())
print(platform.python_version())
```

## Internet and communication

| Library | Purpose |
|---|---|
| `socket` | Network communication |
| `ssl` | TLS/SSL support |
| `urllib` | URL handling |
| `http` | HTTP functionality |
| `email` | Email handling |
| `smtplib` | Sending email using SMTP |
| `ftplib` | FTP client |
| `asyncio` | Asynchronous programming |

## User interfaces

| Library | Purpose |
|---|---|
| `tkinter` | Desktop graphical interfaces |
| `turtle` | Drawing and graphics |
| `curses` | Terminal interfaces on supported platforms |

Example Tkinter application:

```python
import tkinter as tk

root = tk.Tk()

root.title("My Application")
root.geometry("400x300")

label = tk.Label(root, text="Hello Python!")
label.pack()

root.mainloop()
```

## Text processing

| Library | Purpose |
|---|---|
| `re` | Regular expressions |
| `string` | String constants and helpers |
| `textwrap` | Format paragraphs |
| `difflib` | Compare text |
| `unicodedata` | Unicode information |

## Dates and scheduling

| Library | Purpose |
|---|---|
| `datetime` | Dates and times |
| `time` | Time functions |
| `calendar` | Calendar calculations |
| `zoneinfo` | Time zones |
| `sched` | Event scheduling |

## Data structures and utilities

| Library | Purpose |
|---|---|
| `collections` | Specialised data structures |
| `itertools` | Iterator tools |
| `functools` | Higher-order function utilities |
| `operator` | Standard operators as functions |
| `heapq` | Heap queues |
| `bisect` | Sorted-list operations |
| `array` | Typed arrays |
| `enum` | Enumerations |
| `copy` | Object copying |
| `dataclasses` | Data classes |
| `typing` | Type annotations |
| `weakref` | Weak references |

---

# 41. IMPORTANT COLLECTION UTILITIES

## 41.1 collections.Counter

Counts occurrences.

```python
from collections import Counter

items = ["apple", "banana", "apple", "orange"]

counts = Counter(items)

print(counts)
print(counts["apple"])
```

## 41.2 defaultdict

Provides a default value for missing keys.

```python
from collections import defaultdict

groups = defaultdict(list)

groups["fruits"].append("Apple")
groups["fruits"].append("Banana")

print(groups)
```

## 41.3 deque

A double-ended queue.

```python
from collections import deque

queue = deque([1, 2, 3])

queue.append(4)
queue.appendleft(0)

queue.pop()
queue.popleft()

print(queue)
```

## 41.4 namedtuple

Creates tuple-like objects with named fields.

```python
from collections import namedtuple

Person = namedtuple("Person", ["name", "age"])

person = Person("Nathan", 13)

print(person.name)
print(person.age)
```

## 41.5 itertools

Useful iterator operations.

```python
import itertools
```

Infinite counter:

```python
for number in itertools.count(1):
    if number > 5:
        break

    print(number)
```

Repeat:

```python
print(list(itertools.repeat("Hello", 3)))
```

Chain:

```python
a = [1, 2]
b = [3, 4]

print(list(itertools.chain(a, b)))
```

Permutations:

```python
print(list(itertools.permutations([1, 2, 3])))
```

Combinations:

```python
print(list(itertools.combinations([1, 2, 3], 2)))
```

---

# 42. PYTHON SYNTAX REFERENCE

## 42.1 Basic syntax

```python
variable = value

if condition:
    statement

for item in iterable:
    statement

while condition:
    statement

def function():
    statement

class MyClass:
    statement

try:
    statement
except Exception:
    statement
```

## 42.2 Important Python keywords

These are reserved words and cannot be used as ordinary variable names.

```text
False
None
True
and
as
assert
async
await
break
class
continue
def
del
elif
else
except
finally
for
from
global
if
import
in
is
lambda
nonlocal
not
or
pass
raise
return
try
while
with
yield
```

Additional contextual keywords:

```text
match
case
```

## 42.3 Assignment expressions (walrus operator)

The `:=` operator assigns a value inside an expression.

```python
if (length := len("Python")) > 3:
    print(length)
```

Useful for avoiding repeated calculations.

## 42.4 Unpacking

```python
a, b = (10, 20)

first, *middle, last = [1, 2, 3, 4, 5]

print(first)
print(middle)
print(last)
```

## 42.5 Multiple statements

Although possible, putting multiple statements on one line is generally discouraged.

```python
a = 10; b = 20; print(a + b)
```

Prefer:

```python
a = 10
b = 20

print(a + b)
```

---

# 43. COMMON PYTHON PROGRAMMING PATTERNS

## 43.1 Check whether a number is even

```python
number = 10

if number % 2 == 0:
    print("Even")
else:
    print("Odd")
```

## 43.2 Find the largest number

```python
numbers = [10, 50, 20, 90, 30]

largest = max(numbers)

print(largest)
```

## 43.3 Find duplicates

```python
numbers = [1, 2, 3, 2, 4, 1]

duplicates = {
    number
    for number in numbers
    if numbers.count(number) > 1
}

print(duplicates)
```

For large lists, a `Counter` or set-based approach is more efficient.

## 43.4 Reverse a string

```python
text = "Python"

print(text[::-1])
```

## 43.5 Check a palindrome

```python
text = "racecar"

if text == text[::-1]:
    print("Palindrome")
```

## 43.6 Count characters

```python
text = "Hello World"

print(len(text))
print(text.count("l"))
```

## 43.7 Remove duplicates

Preserve original order:

```python
numbers = [1, 2, 2, 3, 1, 4]

unique = list(dict.fromkeys(numbers))

print(unique)
```

## 43.8 Swap variables

```python
a = 10
b = 20

a, b = b, a
```

## 43.9 Generate a multiplication table

```python
number = 5

for i in range(1, 13):
    print(f"{number} x {i} = {number * i}")
```

## 43.10 Fibonacci sequence

```python
a, b = 0, 1

for _ in range(10):
    print(a)

    a, b = b, a + b
```

## 43.11 Binary conversion

```python
number = 25

print(bin(number))
print(int("11001", 2))
```

## 43.12 Hexadecimal conversion

```python
number = 255

print(hex(number))
print(int("FF", 16))
```

## 43.13 Frequency counting

```python
from collections import Counter

text = "hello world"

frequency = Counter(text)

print(frequency)
```

## 43.14 Simple input validation

```python
while True:
    try:
        age = int(input("Enter age: "))

        if age < 0:
            print("Age cannot be negative.")
            continue

        break

    except ValueError:
        print("Enter a valid number.")

print("Age:", age)
```

---

# 44. COMPLETE EXAMPLE PROGRAMS

These examples combine several Python concepts into working programs.

## 44.1 Calculator

```python
def calculator():
    print("PYTHON CALCULATOR")

    a = float(input("First number: "))
    operator = input("Operator (+, -, *, /): ")
    b = float(input("Second number: "))

    if operator == "+":
        result = a + b

    elif operator == "-":
        result = a - b

    elif operator == "*":
        result = a * b

    elif operator == "/":
        if b == 0:
            print("Cannot divide by zero.")
            return

        result = a / b

    else:
        print("Unknown operator.")
        return

    print("Result:", result)


if __name__ == "__main__":
    calculator()
```

## 44.2 Number guessing game

```python
import random

secret = random.randint(1, 100)
attempts = 0

print("Guess the number between 1 and 100.")

while True:
    try:
        guess = int(input("Your guess: "))

        attempts += 1

        if guess < secret:
            print("Too low!")

        elif guess > secret:
            print("Too high!")

        else:
            print(f"Correct! Attempts: {attempts}")
            break

    except ValueError:
        print("Please enter a valid integer.")
```

## 44.3 Simple login system

```python
users = {
    "admin": "password123",
    "student": "python456"
}


def login(username, password):
    if username not in users:
        return False

    return users[username] == password


username = input("Username: ")
password = input("Password: ")

if login(username, password):
    print("Login successful!")
else:
    print("Incorrect login details.")
```

Note: This is a learning example, not a secure authentication system. Real applications should use password hashing and appropriate account protections.

## 44.4 Simple file-based database

```python
import json
from pathlib import Path

DATABASE = Path("database.json")


def load_database():
    if not DATABASE.exists():
        return {}

    try:
        return json.loads(DATABASE.read_text(encoding="utf-8"))

    except json.JSONDecodeError:
        return {}


def save_database(data):
    DATABASE.write_text(
        json.dumps(data, indent=4),
        encoding="utf-8"
    )


def add_user(name, age):
    data = load_database()

    data[name] = {
        "age": age
    }

    save_database(data)


def display_users():
    data = load_database()

    for name, details in data.items():
        print(name, details)


add_user("Nathan", 13)
display_users()
```

## 44.5 Simple object-oriented banking system

```python
class BankAccount:

    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Amount must be positive")

        self.balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("Amount must be positive")

        if amount > self.balance:
            print("Insufficient funds")
            return

        self.balance -= amount

    def show_balance(self):
        print(f"{self.owner}: ${self.balance:.2f}")


account = BankAccount("Nathan", 100)

account.deposit(50)
account.withdraw(25)

account.show_balance()
```

---

# 45. PYTHON BEST PRACTICES

## Naming conventions

| Element | Recommended style | Example |
|---|---|---|
| Variables | snake_case | `user_name` |
| Functions | snake_case | `calculate_total()` |
| Classes | PascalCase | `UserAccount` |
| Constants | UPPER_CASE | `MAX_USERS` |
| Modules | lowercase | `calculator.py` |
| Private-by-convention names | Leading underscore | `_internal_value` |

## Code organisation

A good Python project might look like this:

```text
MyProject/
│
├── main.py
├── config.py
├── requirements.txt
│
├── modules/
│   ├── calculator.py
│   └── database.py
│
├── assets/
│   └── icon.png
│
├── data/
│   └── database.json
│
└── tests/
    └── test_main.py
```

## Important habits

1. Use meaningful variable names.
2. Write reusable functions.
3. Avoid repeating the same code unnecessarily.
4. Handle expected errors.
5. Use `with open()` for file operations.
6. Use virtual environments for projects.
7. Separate large programs into modules.
8. Use type hints where helpful.
9. Write tests for important functionality.
10. Use comments to explain why something happens, not merely repeat what the code says.
11. Avoid unnecessary global variables.
12. Prefer readable code over unnecessarily short code.
13. Never execute untrusted input using `eval()` or `exec()`.
14. Validate user input.
15. Keep passwords and API keys out of source code.

---

# 46. QUICK REFERENCE: MOST IMPORTANT SYNTAX

| Syntax | Purpose |
|---|---|
| `# comment` | Comment |
| `print()` | Output |
| `input()` | User input |
| `variable = value` | Assignment |
| `if` | Conditional |
| `elif` | Additional condition |
| `else` | Alternative condition |
| `for` | Iteration |
| `while` | Conditional loop |
| `break` | Exit loop |
| `continue` | Skip iteration |
| `pass` | Placeholder |
| `def` | Define function |
| `return` | Return value |
| `lambda` | Anonymous function |
| `yield` | Generator output |
| `class` | Define class |
| `self` | Current instance |
| `super()` | Parent-class functionality |
| `try` | Begin exception handling |
| `except` | Handle exception |
| `finally` | Always-run cleanup |
| `raise` | Trigger exception |
| `assert` | Check condition |
| `import` | Import module |
| `from` | Import specific functionality |
| `as` | Assign alias |
| `with` | Context management |
| `async` | Define asynchronous function |
| `await` | Await asynchronous operation |
| `global` | Refer to global variable |
| `nonlocal` | Refer to enclosing variable |
| `del` | Delete reference/item |
| `in` | Membership check |
| `is` | Identity check |
| `and` | Logical AND |
| `or` | Logical OR |
| `not` | Logical NOT |
| `match` | Pattern matching |
| `case` | Pattern-matching branch |
| `:=` | Assignment expression |
| `@decorator` | Apply decorator |
| `...` | Ellipsis object |

---

# FINAL NOTE

Python is a large language, and mastering every feature takes time. You do not need to memorise this entire guide.

A useful learning order is:

**Stage 1:** Variables, data types, operators, strings and input/output.

**Stage 2:** Conditions, loops, lists, tuples, sets and dictionaries.

**Stage 3:** Functions, modules, exceptions and file handling.

**Stage 4:** Classes, inheritance, OOP, comprehensions and decorators.

**Stage 5:** APIs, databases, networking, threading and asynchronous programming.

**Stage 6:** Testing, debugging, optimisation, architecture and advanced Python internals.

The best way to learn Python is to build things with it. Start with small scripts, gradually combine concepts, and eventually develop complete applications.

**End of Python Cheat Sheet.**/
`;

export const WEB_DOC = `
# COMPLETE WEB DEVELOPMENT CHEAT SHEET
## HTML5, CSS3 AND JAVASCRIPT
/# COMPLETE WEB DEVELOPMENT CHEAT SHEET
## HTML5, CSS3 AND JAVASCRIPT
**Level:** Beginner → Advanced  
**Technologies:** HTML, CSS, JavaScript (ES6+)  
**Purpose:** Complete syntax reference and practical programming guide

---

# TABLE OF CONTENTS

## PART I: HTML
1. HTML Fundamentals
2. HTML Document Structure
3. HTML Tags and Elements
4. HTML Attributes
5. Text Formatting
6. Headings and Paragraphs
7. Links and Navigation
8. Images and Media
9. Lists
10. Tables
11. Forms and Input Elements
12. Semantic HTML
13. HTML5 Features
14. Audio and Video
15. Canvas and SVG
16. Iframes
17. Metadata and SEO
18. HTML Accessibility
19. HTML Entities
20. HTML Best Practices

## PART II: CSS
21. CSS Fundamentals
22. CSS Selectors
23. CSS Combinators
24. CSS Specificity
25. CSS Colours
26. Text and Typography
27. Backgrounds
28. Borders and Outlines
29. The CSS Box Model
30. Width, Height and Sizing
31. Display Properties
32. Positioning
33. Flexbox
34. CSS Grid
35. Margins and Padding
36. Overflow and Visibility
37. Pseudo-Classes
38. Pseudo-Elements
39. Transitions
40. Transformations
41. Animations
42. Responsive Design
43. Media Queries
44. CSS Variables
45. Functions in CSS
46. Filters and Effects
47. Shadows
48. CSS Units
49. CSS Functions and Modern Features
50. CSS Best Practices

## PART III: JAVASCRIPT
51. JavaScript Fundamentals
52. Variables and Data Types
53. Operators
54. Strings
55. Numbers and Mathematics
56. Conditions
57. Loops
58. Arrays
59. Objects
60. Functions
61. Arrow Functions
62. Scope and Closures
63. Array Methods
64. Object Methods
65. Destructuring
66. Spread and Rest Operators
67. Classes and OOP
68. Inheritance
69. Error Handling
70. DOM Manipulation
71. DOM Selectors
72. DOM Events
73. Event Listeners
74. Forms and Validation
75. Timers and Intervals
76. Local Storage and Session Storage
77. JSON
78. Fetch API
79. Promises
80. Async and Await
81. Modules
82. Regular Expressions
83. Browser APIs
84. Canvas API
85. WebSockets
86. Web Workers
87. JavaScript Security
88. Debugging and Testing

## PART IV: COMBINED WEB DEVELOPMENT
89. Connecting HTML, CSS and JavaScript
90. Website Project Structure
91. Creating Components
92. Dynamic Website Examples
93. Common Website Functions
94. Useful Browser Developer Tools
95. Performance Optimisation
96. Accessibility
97. Deployment and Hosting
98. Common Errors
99. Complete Example Projects

---

# PART I: HTML

# 1. HTML FUNDAMENTALS

HTML stands for HyperText Markup Language.

HTML defines the structure of a webpage using elements called tags.

HTML is not a programming language. It is a markup language.

## 1.1 Creating an HTML file

HTML files normally use the `.html` extension.

Examples:

```text
index.html
about.html
contact.html
dashboard.html
```

## 1.2 Basic HTML syntax

```html
<tagname>Content goes here</tagname>
```

Example:

```html
<h1>Hello World</h1>
```

This creates a level-one heading.

Most HTML elements have:
- An opening tag.
- Content.
- A closing tag.

Some elements are void elements and do not have closing tags.

Examples:

```html
<img src="image.png" alt="An image">
<br>
<hr>
<input type="text">
```

## 1.3 HTML comments

```html
<!-- This is an HTML comment -->
```

Multiline:

```html
<!--
This is a
multiline comment.
-->
```

Comments are not displayed on the webpage.

---

# 2. HTML DOCUMENT STRUCTURE

Every normal HTML document should contain a basic structure.

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>My Website</title>

</head>

<body>

    <h1>Hello World</h1>

    <p>Welcome to my website.</p>

</body>

</html>
```

## 2.1 Explanation

| Element | Purpose |
|---|---|
| `<!DOCTYPE html>` | Declares an HTML5 document |
| `<html>` | Root element |
| `<head>` | Contains metadata and linked resources |
| `<meta>` | Provides document metadata |
| `<title>` | Sets browser tab title |
| `<body>` | Contains visible webpage content |

## 2.2 Connecting CSS

External stylesheet:

```html
<link rel="stylesheet" href="style.css">
```

Usually placed inside `<head>`.

Internal CSS:

```html
<style>
    body {
        background: black;
        color: white;
    }
</style>
```

Inline CSS:

```html
<h1 style="color: red;">Hello</h1>
```

External CSS is generally preferred for larger websites.

## 2.3 Connecting JavaScript

External JavaScript:

```html
<script src="script.js"></script>
```

A common approach is to use `defer`:

```html
<script src="script.js" defer></script>
```

This downloads the script while HTML is being parsed and executes it after parsing is complete.

Alternatively:

```html
<script>
    console.log("Hello World");
</script>
```

---

# 3. HTML TAGS AND ELEMENTS

## 3.1 Basic tags

| Tag | Purpose |
|---|---|
| `<html>` | HTML document |
| `<head>` | Document metadata |
| `<body>` | Visible content |
| `<title>` | Browser tab title |
| `<h1>` | Main heading |
| `<h2>` | Second-level heading |
| `<h3>` | Third-level heading |
| `<h4>` | Fourth-level heading |
| `<h5>` | Fifth-level heading |
| `<h6>` | Sixth-level heading |
| `<p>` | Paragraph |
| `<br>` | Line break |
| `<hr>` | Horizontal thematic break |
| `<div>` | Generic block container |
| `<span>` | Generic inline container |

Example:

```html
<div>
    <h1>My Website</h1>

    <p>This is a paragraph.</p>

    <span>Inline text</span>
</div>
```

## 3.2 Block elements

Block elements normally begin on a new line and occupy the available width.

Examples:

```html
<div>Block one</div>
<p>Block two</p>
<h1>Heading</h1>
<section>Section</section>
```

## 3.3 Inline elements

Inline elements normally occupy only the space needed by their content.

Examples:

```html
<span>Text</span>
<strong>Important</strong>
<em>Emphasised</em>
<a href="#">Link</a>
```

---

# 4. HTML ATTRIBUTES

Attributes provide additional information about elements.

Syntax:

```html
<tag attribute="value">Content</tag>
```

Example:

```html
<p class="description" id="intro">
    Welcome.
</p>
```

## 4.1 Common HTML attributes

| Attribute | Purpose |
|---|---|
| `id` | Unique element identifier |
| `class` | Assigns CSS classes |
| `style` | Inline CSS |
| `title` | Additional information |
| `hidden` | Hides an element |
| `lang` | Language |
| `dir` | Text direction |
| `tabindex` | Keyboard focus order |
| `contenteditable` | Makes content editable |
| `draggable` | Controls drag capability |
| `data-*` | Stores custom data attributes |
| `role` | Accessibility role |
| `aria-*` | Accessibility information |

Example:

```html
<div
    id="container"
    class="main-container"
    data-user="Nathan"
    title="Main container">

    Hello!

</div>
```

## 4.2 ID versus class

ID:

```html
<h1 id="main-title">Welcome</h1>
```

Class:

```html
<p class="description">Hello</p>
<p class="description">World</p>
```

An ID should identify one unique element within a document. Classes can be reused.

---

# 5. TEXT FORMATTING

| Tag | Purpose |
|---|---|
| `<b>` | Stylistically bold text |
| `<strong>` | Important text |
| `<i>` | Alternate voice or mood |
| `<em>` | Emphasised text |
| `<u>` | Underlined text |
| `<s>` | No longer accurate or relevant text |
| `<del>` | Deleted text |
| `<ins>` | Inserted text |
| `<mark>` | Highlighted text |
| `<small>` | Smaller text |
| `<sub>` | Subscript |
| `<sup>` | Superscript |
| `<code>` | Code fragment |
| `<pre>` | Preformatted text |
| `<kbd>` | Keyboard input |
| `<samp>` | Sample output |
| `<var>` | Variable |
| `<blockquote>` | Block quotation |
| `<q>` | Inline quotation |
| `<cite>` | Work title citation |
| `<abbr>` | Abbreviation |
| `<time>` | Date or time |

Examples:

```html
<strong>Important information</strong>

<em>Emphasised information</em>

<mark>Highlighted text</mark>

H<sub>2</sub>O

x<sup>2</sup>

<del>Old price</del>

<ins>New price</ins>
```

Code formatting:

```html
<pre>
    <code>
        print("Hello World")
    </code>
</pre>
```

Keyboard input:

```html
<p>Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.</p>
```

---

# 6. HEADINGS AND PARAGRAPHS

HTML provides six heading levels.

```html
<h1>Main Heading</h1>

<h2>Section Heading</h2>

<h3>Subsection</h3>

<h4>Smaller Heading</h4>

<h5>Smaller Heading</h5>

<h6>Smallest Heading</h6>
```

Paragraph:

```html
<p>This is a paragraph.</p>
```

Line break:

```html
<p>Hello<br>World</p>
```

Horizontal divider:

```html
<hr>
```

Use headings according to document structure, not merely their visual appearance.

---

# 7. LINKS AND NAVIGATION

The `<a>` element creates hyperlinks.

## 7.1 Basic link

```html
<a href="https://example.com">Visit Website</a>
```

## 7.2 Open in new tab

```html
<a href="https://example.com" target="_blank" rel="noopener">
    Open Website
</a>
```

## 7.3 Internal page navigation

```html
<a href="about.html">About</a>
<a href="contact.html">Contact</a>
```

## 7.4 Jump to an element

```html
<a href="#section2">Go to Section 2</a>

<h2 id="section2">Section 2</h2>
```

## 7.5 Email link

```html
<a href="mailto:example@email.com">Email Us</a>
```

## 7.6 Telephone link

```html
<a href="tel:+6512345678">Call Us</a>
```

## 7.7 Download link

```html
<a href="document.pdf" download>Download PDF</a>
```

## 7.8 Link attributes

| Attribute | Purpose |
|---|---|
| `href` | Destination |
| `target` | Where to open |
| `rel` | Relationship/security hints |
| `download` | Suggest downloading |
| `hreflang` | Language of linked resource |
| `type` | Media type hint |

---

# 8. IMAGES AND MEDIA

## 8.1 Images

```html
<img src="image.png" alt="Description">
```

Common attributes:

| Attribute | Purpose |
|---|---|
| `src` | Image source |
| `alt` | Alternative text |
| `width` | Image width |
| `height` | Image height |
| `loading` | Loading behaviour |
| `decoding` | Image decoding hint |
| `srcset` | Multiple image sources |
| `sizes` | Responsive image sizing |

Example:

```html
<img
    src="landscape.jpg"
    alt="Mountain landscape"
    width="800"
    height="500"
    loading="lazy">
```

## 8.2 Responsive images

```html
<img
    src="small.jpg"
    srcset="
        small.jpg 480w,
        medium.jpg 800w,
        large.jpg 1200w
    "
    sizes="(max-width: 600px) 480px, 800px"
    alt="Landscape">
```

## 8.3 Figure and caption

```html
<figure>
    <img src="image.jpg" alt="A landscape">

    <figcaption>
        A beautiful landscape.
    </figcaption>
</figure>
```

## 8.4 Audio

```html
<audio controls>
    <source src="audio.mp3" type="audio/mpeg">
    Your browser does not support audio.
</audio>
```

Useful attributes:

- `controls`
- `autoplay`
- `loop`
- `muted`
- `preload`

## 8.5 Video

```html
<video width="640" height="360" controls>
    <source src="video.mp4" type="video/mp4">
    Your browser does not support video.
</video>
```

Other attributes:

```html
<video
    controls
    autoplay
    muted
    loop
    playsinline
    poster="thumbnail.jpg">

    <source src="video.mp4" type="video/mp4">

</video>
```

Autoplay with sound is generally restricted by browsers.

## 8.6 Video subtitles

```html
<video controls>
    <source src="video.mp4" type="video/mp4">

    <track
        src="subtitles.vtt"
        kind="subtitles"
        srclang="en"
        label="English">
</video>
```

---

# 9. LISTS

## 9.1 Unordered list

```html
<ul>
    <li>Apple</li>
    <li>Banana</li>
    <li>Orange</li>
</ul>
```

## 9.2 Ordered list

```html
<ol>
    <li>First</li>
    <li>Second</li>
    <li>Third</li>
</ol>
```

## 9.3 Ordered list attributes

```html
<ol start="5">
    <li>Five</li>
    <li>Six</li>
</ol>
```

Reverse order:

```html
<ol reversed>
    <li>Three</li>
    <li>Two</li>
    <li>One</li>
</ol>
```

Different numbering:

```html
<ol type="A">
    <li>First</li>
    <li>Second</li>
</ol>
```

Possible types:

- `1`
- `A`
- `a`
- `I`
- `i`

## 9.4 Description lists

```html
<dl>
    <dt>HTML</dt>
    <dd>Defines webpage structure.</dd>

    <dt>CSS</dt>
    <dd>Controls webpage appearance.</dd>
</dl>
```

---

# 10. TABLES

Tables organise information into rows and columns.

## 10.1 Basic table

```html
<table>
    <tr>
        <th>Name</th>
        <th>Age</th>
    </tr>

    <tr>
        <td>Nathan</td>
        <td>13</td>
    </tr>
</table>
```

## 10.2 Table elements

| Tag | Purpose |
|---|---|
| `<table>` | Table container |
| `<tr>` | Table row |
| `<th>` | Header cell |
| `<td>` | Data cell |
| `<thead>` | Header section |
| `<tbody>` | Main table content |
| `<tfoot>` | Footer section |
| `<caption>` | Table title |
| `<colgroup>` | Column group |
| `<col>` | Column properties |

## 10.3 Complete table

```html
<table>
    <caption>Student Records</caption>

    <thead>
        <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Class</th>
        </tr>
    </thead>

    <tbody>
        <tr>
            <td>Nathan</td>
            <td>13</td>
            <td>1E</td>
        </tr>

        <tr>
            <td>Alex</td>
            <td>14</td>
            <td>2A</td>
        </tr>
    </tbody>

    <tfoot>
        <tr>
            <td colspan="3">Total: 2 students</td>
        </tr>
    </tfoot>
</table>
```

## 10.4 colspan

Combines columns.

```html
<td colspan="2">Combined columns</td>
```

## 10.5 rowspan

Combines rows.

```html
<td rowspan="2">Combined rows</td>
```

## 10.6 Table accessibility

```html
<th scope="col">Name</th>
<th scope="row">Nathan</th>
```

Use appropriate table headers and captions.

---

# 11. FORMS AND INPUT ELEMENTS

Forms collect information from users.

## 11.1 Basic form

```html
<form action="/submit" method="POST">

    <label for="username">Username:</label>

    <input
        type="text"
        id="username"
        name="username">

    <button type="submit">Submit</button>

</form>
```

## 11.2 Form attributes

| Attribute | Purpose |
|---|---|
| `action` | Submission destination |
| `method` | GET or POST |
| `enctype` | Encoding type |
| `autocomplete` | Autofill behaviour |
| `novalidate` | Disable built-in validation |
| `target` | Response destination |
| `name` | Form name |
| `accept-charset` | Character encoding |

## 11.3 Input types

| Type | Purpose |
|---|---|
| `text` | Text input |
| `password` | Password input |
| `email` | Email input |
| `number` | Numeric input |
| `tel` | Telephone input |
| `url` | URL input |
| `search` | Search field |
| `date` | Date picker |
| `time` | Time picker |
| `datetime-local` | Local date and time |
| `month` | Month picker |
| `week` | Week picker |
| `color` | Colour picker |
| `range` | Slider |
| `checkbox` | Checkbox |
| `radio` | Radio button |
| `file` | File upload |
| `hidden` | Hidden input |
| `submit` | Submit button |
| `reset` | Reset form |
| `button` | General button |
| `image` | Image submit button |

Examples:

```html
<input type="text" placeholder="Enter username">

<input type="password" placeholder="Password">

<input type="email" placeholder="Email address">

<input type="number" min="1" max="100">

<input type="date">

<input type="color">

<input type="range" min="0" max="100">

<input type="checkbox">

<input type="radio" name="gender" value="male">

<input type="file">
```

## 11.4 Common input attributes

| Attribute | Purpose |
|---|---|
| `placeholder` | Hint text |
| `value` | Initial value |
| `required` | Mandatory input |
| `disabled` | Disable input |
| `readonly` | Prevent editing |
| `checked` | Initially checked |
| `selected` | Initially selected option |
| `min` | Minimum |
| `max` | Maximum |
| `step` | Increment |
| `minlength` | Minimum characters |
| `maxlength` | Maximum characters |
| `pattern` | Regex validation |
| `multiple` | Allow multiple values/files |
| `accept` | Allowed file types |
| `autofocus` | Initially focused |
| `autocomplete` | Autofill hint |

Example:

```html
<input
    type="text"
    minlength="3"
    maxlength="20"
    required
    placeholder="Username">
```

## 11.5 Textarea

```html
<textarea
    rows="5"
    cols="30"
    placeholder="Write something...">
</textarea>
```

## 11.6 Dropdown menu

```html
<select name="country">

    <option value="sg">Singapore</option>

    <option value="my">Malaysia</option>

    <option value="au">Australia</option>

</select>
```

Preselected option:

```html
<option value="sg" selected>Singapore</option>
```

## 11.7 Radio buttons

```html
<label>
    <input type="radio" name="choice" value="yes">
    Yes
</label>

<label>
    <input type="radio" name="choice" value="no">
    No
</label>
```

Radio buttons with the same `name` belong to the same group.

## 11.8 Checkboxes

```html
<label>
    <input type="checkbox" name="subscribe">
    Subscribe
</label>
```

## 11.9 Fieldsets

Group related form inputs.

```html
<fieldset>

    <legend>Personal Information</legend>

    <label for="name">Name:</label>

    <input id="name" name="name" type="text">

</fieldset>
```

## 11.10 File uploads

```html
<input
    type="file"
    accept=".jpg,.png,.pdf"
    multiple>
```

File uploads generally require a server to store or process the uploaded data.

---

# 12. SEMANTIC HTML

Semantic HTML uses elements that describe the meaning of their content.

| Element | Purpose |
|---|---|
| `<header>` | Introductory header |
| `<nav>` | Navigation |
| `<main>` | Main content |
| `<section>` | Thematic section |
| `<article>` | Independent content |
| `<aside>` | Related side content |
| `<footer>` | Footer |
| `<figure>` | Self-contained media |
| `<figcaption>` | Media caption |
| `<details>` | Expandable content |
| `<summary>` | Expandable heading |
| `<address>` | Contact information |
| `<time>` | Date or time |
| `<search>` | Search-related section |

Example:

```html
<header>
    <h1>My Website</h1>

    <nav>
        <a href="/">Home</a>
        <a href="/about.html">About</a>
    </nav>
</header>

<main>

    <section>
        <h2>About Us</h2>

        <p>Welcome to our website.</p>
    </section>

    <article>
        <h2>Latest News</h2>

        <p>News article content.</p>
    </article>

    <aside>
        Related information.
    </aside>

</main>

<footer>
    Copyright 2026
</footer>
```

## 12.1 Details and summary

Creates a native expandable section.

```html
<details>
    <summary>Click to expand</summary>

    <p>Hidden information.</p>
</details>
```

---

# 13. HTML5 FEATURES

## 13.1 Data attributes

Store custom information in HTML.

```html
<button data-user-id="123" data-role="admin">
    User
</button>
```

Access them with JavaScript:

```javascript
const button = document.querySelector("button");

console.log(button.dataset.userId);
console.log(button.dataset.role);
```

## 13.2 Progress bar

```html
<progress value="70" max="100"></progress>
```

## 13.3 Meter

```html
<meter value="0.7" min="0" max="1"></meter>
```

## 13.4 Dialog

```html
<dialog id="myDialog">
    <p>Hello!</p>

    <button id="closeDialog">Close</button>
</dialog>
```

JavaScript:

```javascript
const dialog = document.querySelector("#myDialog");

dialog.showModal();

document.querySelector("#closeDialog").addEventListener("click", () => {
    dialog.close();
});
```

## 13.5 Template element

Stores HTML that is not rendered until cloned using JavaScript.

```html
<template id="cardTemplate">
    <div class="card">
        <h2>Title</h2>
        <p>Description</p>
    </div>
</template>
```

JavaScript:

```javascript
const template = document.querySelector("#cardTemplate");

const clone = template.content.cloneNode(true);

document.body.appendChild(clone);
```

## 13.6 Custom elements

HTML supports custom elements through Web Components.

Example:

```html
<my-element></my-element>
```

JavaScript:

```javascript
class MyElement extends HTMLElement {
    connectedCallback() {
        this.textContent = "Hello from a custom element!";
    }
}

customElements.define("my-element", MyElement);
```

---

# 14. CANVAS AND SVG

## 14.1 HTML Canvas

Canvas provides a drawing surface controlled through JavaScript.

```html
<canvas id="myCanvas" width="500" height="300"></canvas>
```

JavaScript:

```javascript
const canvas = document.querySelector("#myCanvas");

const ctx = canvas.getContext("2d");

ctx.fillStyle = "red";

ctx.fillRect(50, 50, 100, 100);
```

Canvas can draw:
- Shapes
- Text
- Images
- Animations
- Games
- Visualisations

## 14.2 SVG

SVG stands for Scalable Vector Graphics.

Example:

```html
<svg width="200" height="200" viewBox="0 0 200 200">

    <circle
        cx="100"
        cy="100"
        r="80"
        fill="blue">

    </circle>

</svg>
```

Other SVG elements:

```html
<rect x="10" y="10" width="100" height="50" fill="red"/>

<circle cx="50" cy="50" r="20" fill="blue"/>

<ellipse cx="100" cy="100" rx="50" ry="25"/>

<line x1="0" y1="0" x2="100" y2="100" stroke="black"/>

<polygon points="50,0 100,100 0,100"/>

<polyline points="0,0 50,50 100,0"/>
```

---

# 15. IFRAMES

An iframe embeds another webpage or document.

```html
<iframe
    src="https://example.com"
    width="600"
    height="400"
    title="Example website">
</iframe>
```

Common attributes:

- `src`
- `width`
- `height`
- `title`
- `loading`
- `sandbox`
- `allow`
- `referrerpolicy`

Example with sandbox:

```html
<iframe
    src="https://example.com"
    sandbox
    title="Restricted embedded page">
</iframe>
```

Sandbox permissions can be selectively granted. Be careful when allowing scripts and same-origin access together.

---

# 16. METADATA AND SEO

Metadata provides information about a webpage.

## 16.1 Page title

```html
<title>My Website</title>
```

## 16.2 Description

```html
<meta
    name="description"
    content="A website about programming.">
```

## 16.3 Viewport

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## 16.4 Keywords

```html
<meta name="keywords" content="Python, HTML, CSS, JavaScript">
```

Keywords metadata is not a major modern Google ranking factor.

## 16.5 Author

```html
<meta name="author" content="Nathan">
```

## 16.6 Open Graph metadata

Used by social platforms when sharing links.

```html
<meta property="og:title" content="My Website">

<meta property="og:description" content="Welcome!">

<meta property="og:image" content="preview.png">

<meta property="og:url" content="https://example.com">
```

## 16.7 Favicon

```html
<link rel="icon" href="favicon.ico">
```

---

# 17. HTML ACCESSIBILITY

Accessibility makes websites usable by people with different abilities and assistive technologies.

## 17.1 Alternative text

```html
<img src="dog.jpg" alt="A brown dog sitting">
```

Decorative images can use an empty alternative:

```html
<img src="decoration.png" alt="">
```

## 17.2 Labels

```html
<label for="email">Email:</label>

<input type="email" id="email">
```

## 17.3 ARIA attributes

ARIA provides additional accessibility information.

```html
<button aria-label="Close menu">
    X
</button>
```

Other examples:

```html
<div role="alert">
    Invalid password.
</div>
```

```html
<button aria-expanded="false">
    Menu
</button>
```

```html
<div aria-live="polite" id="status">
</div>
```

Use native semantic HTML first. ARIA should supplement it rather than replace appropriate elements.

## 17.4 Keyboard navigation

Make interactive elements accessible using:
- Buttons
- Links
- Inputs
- Appropriate `tabindex`
- Visible focus indicators

Avoid using clickable `<div>` elements when a `<button>` would work.

---

# 18. HTML ENTITIES

HTML entities display special characters.

| Entity | Character |
|---|---|
| `&lt;` | < |
| `&gt;` | > |
| `&amp;` | & |
| `&quot;` | " |
| `&apos;` | ' |
| `&nbsp;` | Non-breaking space |
| `&copy;` | © |
| `&reg;` | ® |
| `&trade;` | ™ |
| `&euro;` | € |
| `&pound;` | £ |
| `&yen;` | ¥ |
| `&cent;` | ¢ |
| `&times;` | × |
| `&divide;` | ÷ |
| `&plusmn;` | ± |
| `&mdash;` | — |
| `&ndash;` | – |
| `&hellip;` | … |

Example:

```html
<p>5 &lt; 10</p>

<p>Copyright &copy; 2026</p>
```

---

# PART II: CSS

# 19. CSS FUNDAMENTALS

CSS stands for Cascading Style Sheets.

CSS controls the appearance and layout of HTML documents.

## 19.1 Basic CSS syntax

```css
selector {
    property: value;
}
```

Example:

```css
h1 {
    color: red;
    font-size: 40px;
}
```

Explanation:

- `h1` is the selector.
- `color` is the property.
- `red` is the value.
- Each declaration ends with a semicolon.

## 19.2 CSS comments

```css
/* This is a CSS comment */
```

Multiline:

```css
/*
This is a
multiline comment.
*/
```

## 19.3 External CSS

HTML:

```html
<link rel="stylesheet" href="style.css">
```

CSS:

```css
body {
    background-color: black;
    color: white;
}
```

---

# 20. CSS SELECTORS

Selectors determine which HTML elements receive styling.

## 20.1 Basic selectors

| Selector | Purpose |
|---|---|
| `*` | All elements |
| `p` | All paragraph elements |
| `.class` | Class selector |
| `#id` | ID selector |
| `h1, p` | Grouped selectors |

Examples:

```css
* {
    box-sizing: border-box;
}

p {
    color: blue;
}

.card {
    background: white;
}

#main {
    width: 100%;
}

h1, h2, h3 {
    font-family: Arial, sans-serif;
}
```

## 20.2 Attribute selectors

| Selector | Purpose |
|---|---|
| `[type]` | Has attribute |
| `[type="text"]` | Exact value |
| `[class~="box"]` | Contains word |
| `[href^="https"]` | Starts with |
| `[href$=".pdf"]` | Ends with |
| `[href*="example"]` | Contains substring |
| `[lang|="en"]` | Exact or hyphenated prefix |

Examples:

```css
input[type="text"] {
    border: 1px solid gray;
}

a[href^="https"] {
    color: green;
}

a[href$=".pdf"] {
    color: red;
}
```

---

# 21. CSS COMBINATORS

Combinators describe relationships between elements.

| Selector | Meaning |
|---|---|
| `A B` | Descendant |
| `A > B` | Direct child |
| `A + B` | Immediately following sibling |
| `A ~ B` | Later sibling |

Examples:

```css
div p {
    color: red;
}
```

All paragraphs inside a div.

```css
div > p {
    color: blue;
}
```

Only direct child paragraphs.

```css
h1 + p {
    color: green;
}
```

The paragraph immediately following an h1.

```css
h1 ~ p {
    color: orange;
}
```

All following sibling paragraphs.

---

# 22. CSS SPECIFICITY

Specificity determines which CSS declaration wins when multiple rules apply.

General priority:

1. Important declarations (`!important`), subject to cascade origin and layer rules.
2. Higher cascade-layer priority.
3. Higher specificity.
4. Later source order when other factors are equal.

Simplified specificity ranking:

| Selector | Specificity |
|---|---|
| `*` | 0-0-0 |
| `p` | 0-0-1 |
| `.box` | 0-1-0 |
| `#main` | 1-0-0 |
| `style=""` | Inline style priority |

Example:

```css
p {
    color: blue;
}

.text {
    color: red;
}

#special {
    color: green;
}
```

HTML:

```html
<p class="text" id="special">
    Hello
</p>
```

The text becomes green.

`!important`:

```css
p {
    color: red !important;
}
```

Avoid overusing `!important`.

---

# 23. CSS COLOURS

## 23.1 Named colours

```css
color: red;
color: blue;
color: black;
color: white;
```

## 23.2 Hexadecimal

```css
color: #ff0000;
background: #000000;
```

Format:

```text
#RRGGBB
```

With alpha:

```css
color: #ff000080;
```

## 23.3 RGB

```css
color: rgb(255, 0, 0);
```

## 23.4 RGBA

```css
color: rgba(255, 0, 0, 0.5);
```

## 23.5 HSL

```css
color: hsl(0, 100%, 50%);
```

## 23.6 HSLA

```css
color: hsla(0, 100%, 50%, 0.5);
```

## 23.7 Modern colour syntax

```css
color: rgb(255 0 0 / 50%);

color: hsl(0 100% 50% / 50%);
```

## 23.8 Transparency

```css
opacity: 0.5;
```

Opacity affects the entire element, including its children.

---

# 24. TEXT AND TYPOGRAPHY

## 24.1 Text properties

| Property | Purpose |
|---|---|
| `color` | Text colour |
| `font-family` | Font |
| `font-size` | Text size |
| `font-weight` | Thickness |
| `font-style` | Italic or normal |
| `text-align` | Horizontal alignment |
| `text-decoration` | Underline, strike-through |
| `text-transform` | Capitalisation |
| `text-indent` | First-line indentation |
| `letter-spacing` | Character spacing |
| `word-spacing` | Word spacing |
| `line-height` | Line height |
| `white-space` | Whitespace handling |
| `text-overflow` | Overflow appearance |
| `overflow-wrap` | Long-word wrapping |
| `word-break` | Word-breaking behaviour |
| `text-shadow` | Text shadow |
| `vertical-align` | Inline alignment |

Examples:

```css
p {
    color: white;

    font-family: Arial, sans-serif;

    font-size: 18px;

    font-weight: 600;

    text-align: center;

    line-height: 1.5;

    letter-spacing: 1px;
}
```

## 24.2 Font weights

Common values:

```css
font-weight: 100;
font-weight: 200;
font-weight: 300;
font-weight: 400;
font-weight: 500;
font-weight: 600;
font-weight: 700;
font-weight: 800;
font-weight: 900;
```

Named values:

```css
font-weight: normal;
font-weight: bold;
```

## 24.3 Text decoration

```css
text-decoration: underline;

text-decoration: line-through;

text-decoration: overline;

text-decoration: none;
```

## 24.4 Text transformation

```css
text-transform: uppercase;

text-transform: lowercase;

text-transform: capitalize;
```

## 24.5 Text shadow

```css
text-shadow: 2px 2px 5px black;
```

Syntax:

```css
text-shadow: horizontal vertical blur colour;
```

## 24.6 Custom fonts

```css
@font-face {
    font-family: "MyFont";

    src: url("font.woff2") format("woff2");

    font-weight: 400;

    font-style: normal;
}
```

Using it:

```css
body {
    font-family: "MyFont", sans-serif;
}
```

## 24.7 Google Fonts

HTML:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">

<link
    href="https://fonts.googleapis.com/css2?family=Roboto&display=swap"
    rel="stylesheet">
```

CSS:

```css
body {
    font-family: "Roboto", sans-serif;
}
```

---

# 25. BACKGROUNDS

## 25.1 Background colour

```css
body {
    background-color: black;
}
```

## 25.2 Background image

```css
body {
    background-image: url("background.jpg");
}
```

## 25.3 Background properties

| Property | Purpose |
|---|---|
| `background-color` | Background colour |
| `background-image` | Image or gradient |
| `background-repeat` | Repeat behaviour |
| `background-position` | Image position |
| `background-size` | Image size |
| `background-attachment` | Scroll behaviour |
| `background-clip` | Background painting area |
| `background-origin` | Background positioning area |
| `background-blend-mode` | Image blending |

Example:

```css
body {
    background-image: url("background.jpg");

    background-repeat: no-repeat;

    background-position: center;

    background-size: cover;

    background-attachment: fixed;
}
```

## 25.4 Gradients

Linear gradient:

```css
background: linear-gradient(red, blue);
```

Horizontal gradient:

```css
background: linear-gradient(to right, red, blue);
```

Angled gradient:

```css
background: linear-gradient(45deg, red, blue);
```

Radial gradient:

```css
background: radial-gradient(circle, red, blue);
```

Conic gradient:

```css
background: conic-gradient(red, yellow, blue, red);
```

---

# 26. BORDERS AND OUTLINES

## 26.1 Border syntax

```css
border: 2px solid red;
```

Format:

```text
width style colour
```

Border styles:

- `none`
- `solid`
- `dashed`
- `dotted`
- `double`
- `groove`
- `ridge`
- `inset`
- `outset`

## 26.2 Individual borders

```css
border-top: 2px solid red;

border-right: 2px solid blue;

border-bottom: 2px solid green;

border-left: 2px solid yellow;
```

## 26.3 Border radius

```css
border-radius: 10px;
```

Individual corners:

```css
border-top-left-radius: 10px;

border-top-right-radius: 10px;

border-bottom-left-radius: 10px;

border-bottom-right-radius: 10px;
```

Circle:

```css
border-radius: 50%;
```

## 26.4 Outline

```css
outline: 2px solid blue;
```

Unlike borders, outlines do not occupy layout space.

---

# 27. THE CSS BOX MODEL

Every element is represented by a rectangular box.

The box model contains:

1. Content
2. Padding
3. Border
4. Margin

Example:

```css
.box {
    width: 200px;

    padding: 20px;

    border: 5px solid black;

    margin: 10px;
}
```

With the default `content-box`, total width:

```text
200 + 40 + 10 = 250px
```

This excludes margins.

## 27.1 box-sizing

Default:

```css
box-sizing: content-box;
```

Recommended common reset:

```css
* {
    box-sizing: border-box;
}
```

With `border-box`, padding and borders are included within the specified width and height.

---

# 28. WIDTH, HEIGHT AND SIZING

Common properties:

```css
width: 500px;

height: 300px;

min-width: 200px;

max-width: 1000px;

min-height: 100px;

max-height: 500px;
```

Responsive width:

```css
.container {
    width: 90%;

    max-width: 1200px;

    margin: auto;
}
```

Intrinsic sizing:

```css
width: min-content;

width: max-content;

width: fit-content;
```

Modern sizing functions:

```css
width: min(90%, 1200px);

width: max(300px, 50%);

width: clamp(300px, 80%, 1200px);
```

---

# 29. DISPLAY PROPERTIES

The `display` property determines how an element participates in layout.

## 29.1 Common display values

| Value | Purpose |
|---|---|
| `block` | Block layout |
| `inline` | Inline layout |
| `inline-block` | Inline with box dimensions |
| `flex` | Flexbox container |
| `inline-flex` | Inline flex container |
| `grid` | Grid container |
| `inline-grid` | Inline grid |
| `none` | Removes element from layout |
| `contents` | Removes element's own box |
| `flow-root` | Creates independent block formatting context |
| `table` | Table-like layout |
| `list-item` | List-item layout |

Examples:

```css
div {
    display: block;
}

span {
    display: inline;
}

button {
    display: inline-block;
}

.container {
    display: flex;
}
```

Hide an element:

```css
.hidden {
    display: none;
}
```

Alternative:

```css
.hidden {
    visibility: hidden;
}
```

Difference:
- `display: none` removes the element from layout.
- `visibility: hidden` keeps its layout space.

---

# 30. POSITIONING

CSS provides several positioning modes.

## 30.1 Static

Default positioning.

```css
.box {
    position: static;
}
```

## 30.2 Relative

Positions an element relative to its normal position.

```css
.box {
    position: relative;

    top: 10px;

    left: 20px;
}
```

## 30.3 Absolute

Positions an element relative to its nearest positioned ancestor.

```css
.parent {
    position: relative;
}

.child {
    position: absolute;

    top: 10px;

    right: 10px;
}
```

## 30.4 Fixed

Positions an element relative to the viewport.

```css
.navbar {
    position: fixed;

    top: 0;

    left: 0;

    width: 100%;
}
```

## 30.5 Sticky

Behaves relatively until reaching a specified scroll position.

```css
header {
    position: sticky;

    top: 0;
}
```

## 30.6 z-index

Controls stacking order within relevant stacking contexts.

```css
.box1 {
    position: absolute;

    z-index: 1;
}

.box2 {
    position: absolute;

    z-index: 2;
}
```

A higher z-index does not always win globally because stacking contexts are isolated.

---

# 31. FLEXBOX

Flexbox creates flexible one-dimensional layouts.

Activate:

```css
.container {
    display: flex;
}
```

## 31.1 Main flex properties

| Property | Purpose |
|---|---|
| `flex-direction` | Main axis direction |
| `flex-wrap` | Allow wrapping |
| `flex-flow` | Shorthand |
| `justify-content` | Main-axis alignment |
| `align-items` | Cross-axis alignment |
| `align-content` | Align multiple lines |
| `gap` | Space between items |

## 31.2 flex-direction

```css
flex-direction: row;

flex-direction: row-reverse;

flex-direction: column;

flex-direction: column-reverse;
```

## 31.3 justify-content

```css
justify-content: flex-start;

justify-content: flex-end;

justify-content: center;

justify-content: space-between;

justify-content: space-around;

justify-content: space-evenly;
```

## 31.4 align-items

```css
align-items: stretch;

align-items: flex-start;

align-items: flex-end;

align-items: center;

align-items: baseline;
```

## 31.5 flex-wrap

```css
flex-wrap: nowrap;

flex-wrap: wrap;

flex-wrap: wrap-reverse;
```

## 31.6 Flex item properties

| Property | Purpose |
|---|---|
| `flex-grow` | Growth factor |
| `flex-shrink` | Shrink factor |
| `flex-basis` | Initial main size |
| `flex` | Shorthand |
| `align-self` | Individual alignment |
| `order` | Visual ordering |

Example:

```css
.container {
    display: flex;

    gap: 20px;
}

.item {
    flex: 1;
}
```

## 31.7 Centering with Flexbox

```css
.container {
    display: flex;

    justify-content: center;

    align-items: center;

    min-height: 100vh;
}
```

---

# 32. CSS GRID

Grid creates two-dimensional layouts using rows and columns.

Activate:

```css
.container {
    display: grid;
}
```

## 32.1 Defining columns

```css
.container {
    display: grid;

    grid-template-columns: 200px 200px 200px;
}
```

Using fractional units:

```css
grid-template-columns: 1fr 1fr 1fr;
```

Using repeat:

```css
grid-template-columns: repeat(3, 1fr);
```

Automatic columns:

```css
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
```

## 32.2 Defining rows

```css
grid-template-rows: 100px 200px;
```

## 32.3 Grid gap

```css
gap: 20px;

row-gap: 10px;

column-gap: 20px;
```

## 32.4 Grid item positioning

```css
.item {
    grid-column: 1 / 3;

    grid-row: 1 / 2;
}
```

Span:

```css
.item {
    grid-column: span 2;
}
```

## 32.5 Grid template areas

```css
.container {
    display: grid;

    grid-template-areas:
        "header header"
        "sidebar content"
        "footer footer";

    grid-template-columns: 200px 1fr;
}

.header {
    grid-area: header;
}

.sidebar {
    grid-area: sidebar;
}

.content {
    grid-area: content;
}

.footer {
    grid-area: footer;
}
```

---

# 33. MARGINS AND PADDING

## 33.1 Margin

Space outside an element.

```css
margin: 20px;
```

Individual sides:

```css
margin-top: 10px;

margin-right: 20px;

margin-bottom: 10px;

margin-left: 20px;
```

## 33.2 Padding

Space inside an element.

```css
padding: 20px;
```

Individual sides:

```css
padding-top: 10px;

padding-right: 20px;

padding-bottom: 10px;

padding-left: 20px;
```

## 33.3 Shorthand

One value:

```css
margin: 10px;
```

Two values:

```css
margin: 10px 20px;
```

Three values:

```css
margin: 10px 20px 30px;
```

Four values:

```css
margin: 10px 20px 30px 40px;
```

Order:

```text
Top Right Bottom Left
```

## 33.4 Automatic centering

```css
.container {
    width: 80%;

    margin-left: auto;

    margin-right: auto;
}
```

Or:

```css
.container {
    margin: 0 auto;
}
```

---

# 34. OVERFLOW AND VISIBILITY

## 34.1 Overflow

| Value | Purpose |
|---|---|
| `visible` | Content can overflow |
| `hidden` | Clip overflow |
| `scroll` | Always provide scrollbars where applicable |
| `auto` | Scrollbars when needed |
| `clip` | Clip without scrolling |

Examples:

```css
.container {
    overflow: hidden;
}
```

Horizontal:

```css
overflow-x: auto;
```

Vertical:

```css
overflow-y: scroll;
```

## 34.2 Cursor

```css
cursor: pointer;

cursor: default;

cursor: not-allowed;

cursor: grab;

cursor: grabbing;

cursor: wait;

cursor: text;

cursor: crosshair;
```

## 34.3 Pointer events

```css
pointer-events: none;
```

Prevents the element from being a pointer-event target.

```css
pointer-events: auto;
```

Restores normal pointer targeting.

## 34.4 User selection

```css
user-select: none;
```

```css
user-select: text;
```

---

# 35. PSEUDO-CLASSES

Pseudo-classes style elements in particular states.

## 35.1 Common pseudo-classes

| Selector | Purpose |
|---|---|
| `:hover` | Pointer hovering |
| `:active` | Active interaction |
| `:focus` | Focused element |
| `:focus-visible` | Keyboard-style visible focus |
| `:focus-within` | Container contains focused element |
| `:visited` | Visited link |
| `:link` | Unvisited link |
| `:checked` | Checked control |
| `:disabled` | Disabled control |
| `:enabled` | Enabled control |
| `:required` | Required form input |
| `:optional` | Optional input |
| `:valid` | Valid input |
| `:invalid` | Invalid input |
| `:read-only` | Read-only input |
| `:placeholder-shown` | Visible placeholder |
| `:first-child` | First child |
| `:last-child` | Last child |
| `:nth-child()` | Child by position |
| `:nth-of-type()` | Element by type position |
| `:not()` | Exclude selector |
| `:is()` | Match selector list |
| `:where()` | Match selector list with zero specificity |
| `:has()` | Relational selector |
| `:root` | Document root |

Examples:

```css
button:hover {
    background: blue;
}

button:active {
    transform: scale(0.95);
}

input:focus {
    outline: 2px solid blue;
}

li:first-child {
    color: red;
}

li:nth-child(2) {
    color: green;
}

li:nth-child(odd) {
    background: lightgray;
}

.card:not(.active) {
    opacity: 0.5;
}

form:has(input:invalid) {
    border: 1px solid red;
}
```

---

# 36. PSEUDO-ELEMENTS

Pseudo-elements style specific parts of elements.

| Selector | Purpose |
|---|---|
| `::before` | Insert generated content before |
| `::after` | Insert generated content after |
| `::first-letter` | First letter |
| `::first-line` | First line |
| `::selection` | Selected text |
| `::placeholder` | Placeholder text |
| `::marker` | List marker |
| `::backdrop` | Backdrop of certain top-layer elements |
| `::file-selector-button` | File input button |

Examples:

```css
h1::before {
    content: "★ ";
}

h1::after {
    content: "!";
}

p::first-letter {
    font-size: 30px;
}

::selection {
    background: yellow;

    color: black;
}

input::placeholder {
    color: gray;
}
```

---

# 37. CSS TRANSITIONS

Transitions smoothly animate changes in CSS properties.

Syntax:

```css
transition: property duration timing-function delay;
```

Example:

```css
button {
    background: blue;

    transition: background 0.3s ease;
}

button:hover {
    background: red;
}
```

## 37.1 Transition properties

| Property | Purpose |
|---|---|
| `transition-property` | Property to animate |
| `transition-duration` | Animation duration |
| `transition-timing-function` | Animation speed curve |
| `transition-delay` | Delay |
| `transition` | Shorthand |

Timing functions:

```css
transition-timing-function: linear;

transition-timing-function: ease;

transition-timing-function: ease-in;

transition-timing-function: ease-out;

transition-timing-function: ease-in-out;
```

Custom curve:

```css
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
```

Example:

```css
.card {
    transform: translateY(0);

    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
    transform: translateY(-5px);

    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}
```

---

# 38. CSS TRANSFORMATIONS

The `transform` property changes an element's visual geometry.

## 38.1 Translate

```css
transform: translateX(20px);

transform: translateY(20px);

transform: translate(20px, 30px);
```

## 38.2 Rotate

```css
transform: rotate(45deg);
```

## 38.3 Scale

```css
transform: scale(1.5);

transform: scaleX(2);

transform: scaleY(0.5);
```

## 38.4 Skew

```css
transform: skew(20deg);

transform: skewX(20deg);

transform: skewY(10deg);
```

## 38.5 Multiple transformations

```css
transform: translateX(20px) rotate(45deg) scale(1.2);
```

## 38.6 Transform origin

```css
transform-origin: center;

transform-origin: top left;
```

## 38.7 3D transformations

```css
transform: rotateX(45deg);

transform: rotateY(45deg);

transform: rotateZ(45deg);

transform: translateZ(50px);
```

Perspective:

```css
.parent {
    perspective: 800px;
}
```

---

# 39. CSS ANIMATIONS

CSS animations can change properties over time.

## 39.1 Defining keyframes

```css
@keyframes move {
    from {
        transform: translateX(0);
    }

    to {
        transform: translateX(200px);
    }
}
```

Applying:

```css
.box {
    animation: move 2s ease infinite;
}
```

## 39.2 Animation properties

| Property | Purpose |
|---|---|
| `animation-name` | Keyframe name |
| `animation-duration` | Duration |
| `animation-delay` | Delay |
| `animation-iteration-count` | Number of repetitions |
| `animation-direction` | Direction |
| `animation-fill-mode` | Before/after behaviour |
| `animation-play-state` | Running or paused |
| `animation-timing-function` | Speed curve |
| `animation` | Shorthand |

## 39.3 Animation direction

```css
animation-direction: normal;

animation-direction: reverse;

animation-direction: alternate;

animation-direction: alternate-reverse;
```

## 39.4 Animation repetition

```css
animation-iteration-count: 1;

animation-iteration-count: 5;

animation-iteration-count: infinite;
```

## 39.5 Complete animation

```css
@keyframes fadeIn {
    0% {
        opacity: 0;
        transform: translateY(20px);
    }

    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

.card {
    animation: fadeIn 0.5s ease forwards;
}
```

## 39.6 Reduced motion

Respect users who prefer reduced animations.

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;

        transition-duration: 0.01ms !important;
    }
}
```

---

# 40. RESPONSIVE DESIGN

Responsive design makes websites adapt to different screen sizes.

## 40.1 Viewport metadata

HTML:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## 40.2 Flexible widths

```css
.container {
    width: 90%;

    max-width: 1200px;

    margin: auto;
}
```

## 40.3 Responsive images

```css
img {
    max-width: 100%;

    height: auto;
}
```

## 40.4 Media queries

```css
@media (max-width: 768px) {

    .container {
        width: 100%;
    }

}
```

Common breakpoints are design choices, not fixed rules:

```css
/* Small devices */
@media (max-width: 480px) { }

/* Tablets */
@media (max-width: 768px) { }

/* Laptops */
@media (max-width: 1024px) { }

/* Desktops */
@media (min-width: 1200px) { }
```

## 40.5 Orientation

```css
@media (orientation: landscape) {
    body {
        background: black;
    }
}
```

## 40.6 Hover support

```css
@media (hover: hover) {
    button:hover {
        background: blue;
    }
}
```

## 40.7 Combining queries

```css
@media (min-width: 600px) and (max-width: 1000px) {
    .container {
        width: 80%;
    }
}
```

---

# 41. CSS VARIABLES

CSS custom properties store reusable values.

## 41.1 Defining variables

```css
:root {
    --primary-color: #3498db;

    --background: #111111;

    --text-color: white;

    --spacing: 20px;
}
```

## 41.2 Using variables

```css
button {
    background: var(--primary-color);

    padding: var(--spacing);
}
```

## 41.3 Fallback values

```css
color: var(--unknown-color, white);
```

If the variable is missing or invalid, white is used.

## 41.4 Changing variables

```css
:root {
    --theme-color: blue;
}

.dark-theme {
    --theme-color: black;
}
```

CSS variables can be changed through JavaScript:

```javascript
document.documentElement.style.setProperty(
    "--theme-color",
    "red"
);
```

---

# 42. CSS FUNCTIONS

CSS has many built-in functions.

## 42.1 calc()

Performs mathematical calculations.

```css
width: calc(100% - 40px);
```

## 42.2 min()

Returns the smallest argument.

```css
width: min(90%, 1000px);
```

## 42.3 max()

Returns the largest argument.

```css
width: max(300px, 50%);
```

## 42.4 clamp()

Constrains a value between a minimum and maximum.

```css
font-size: clamp(16px, 4vw, 32px);
```

## 42.5 var()

Uses CSS variables.

```css
color: var(--primary-color);
```

## 42.6 attr()

Uses an attribute value in supported CSS contexts.

```css
.tooltip::after {
    content: attr(data-tooltip);
}
```

## 42.7 url()

References external resources.

```css
background-image: url("image.jpg");
```

## 42.8 Gradient functions

```css
linear-gradient(red, blue);

radial-gradient(circle, red, blue);

conic-gradient(red, yellow, blue);
```

## 42.9 Colour functions

```css
rgb(255 0 0);

hsl(120 100% 50%);

color-mix(in srgb, red 50%, blue);

color(srgb 1 0 0);
```

## 42.10 CSS nesting

Modern CSS supports nested rules.

```css
.card {
    background: white;

    & h2 {
        color: black;
    }

    &:hover {
        background: lightgray;
    }
}
```

---

# 43. FILTERS AND EFFECTS

## 43.1 Filter properties

```css
filter: blur(5px);

filter: brightness(150%);

filter: contrast(200%);

filter: grayscale(100%);

filter: sepia(100%);

filter: saturate(200%);

filter: hue-rotate(90deg);

filter: invert(100%);

filter: opacity(50%);
```

Combining filters:

```css
img {
    filter: grayscale(100%) brightness(80%);
}
```

## 43.2 Backdrop filter

Applies effects to content behind an element.

```css
.panel {
    backdrop-filter: blur(10px);

    background: rgba(255, 255, 255, 0.1);
}
```

## 43.3 Clip path

Creates custom clipping shapes.

```css
clip-path: circle(50%);

clip-path: ellipse(50% 40%);

clip-path: polygon(
    50% 0%,
    100% 100%,
    0% 100%
);
```

## 43.4 Masking

```css
mask-image: linear-gradient(black, transparent);
```

---

# 44. SHADOWS

## 44.1 Box shadow

```css
box-shadow: 5px 5px 10px black;
```

Syntax:

```text
horizontal vertical blur spread colour
```

Inset:

```css
box-shadow: inset 0 0 10px black;
```

Multiple shadows:

```css
box-shadow:
    0 5px 10px rgba(0, 0, 0, 0.2),
    0 10px 20px rgba(0, 0, 0, 0.1);
```

## 44.2 Text shadow

```css
text-shadow: 2px 2px 5px black;
```

---

# 45. CSS UNITS

## 45.1 Absolute units

| Unit | Meaning |
|---|---|
| `px` | CSS pixels |
| `cm` | Centimetres |
| `mm` | Millimetres |
| `in` | Inches |
| `pt` | Points |
| `pc` | Picas |

## 45.2 Relative units

| Unit | Meaning |
|---|---|
| `%` | Percentage |
| `em` | Relative to font size of relevant context |
| `rem` | Relative to root font size |
| `vw` | Viewport width percentage |
| `vh` | Viewport height percentage |
| `vmin` | Smaller viewport dimension |
| `vmax` | Larger viewport dimension |
| `ch` | Width of the zero glyph |
| `ex` | x-height |
| `lh` | Element line height |
| `rlh` | Root line height |

## 45.3 Newer viewport units

```css
width: 100dvw;

height: 100dvh;

height: 100svh;

height: 100lvh;
```

- `dvh`: Dynamic viewport height.
- `svh`: Small viewport height.
- `lvh`: Large viewport height.

## 45.4 Example

```css
.container {
    width: 80%;

    max-width: 1200px;

    padding: 2rem;

    font-size: 1rem;
}
```

---

# 46. OTHER IMPORTANT CSS FEATURES

## 46.1 Scroll behaviour

```css
html {
    scroll-behavior: smooth;
}
```

## 46.2 Scroll snapping

```css
.container {
    overflow-x: auto;

    scroll-snap-type: x mandatory;
}

.item {
    scroll-snap-align: start;
}
```

## 46.3 Aspect ratio

```css
.video {
    aspect-ratio: 16 / 9;
}
```

## 46.4 Object fit

```css
img {
    width: 300px;

    height: 200px;

    object-fit: cover;
}
```

Other values:

- `contain`
- `cover`
- `fill`
- `none`
- `scale-down`

## 46.5 Object position

```css
object-position: center;

object-position: top;

object-position: 50% 30%;
```

## 46.6 Isolation

```css
.container {
    isolation: isolate;
}
```

Creates a new stacking context.

## 46.7 Containment

```css
.widget {
    contain: layout paint;
}
```

Can limit layout and paint effects.

## 46.8 Content visibility

```css
section {
    content-visibility: auto;
}
```

Can allow the browser to skip rendering work for off-screen content.

---

# PART III: JAVASCRIPT

# 47. JAVASCRIPT FUNDAMENTALS

JavaScript is a programming language used to create interactive and dynamic webpages.

JavaScript can run:
- In web browsers.
- On servers using Node.js.
- In desktop applications using frameworks.
- In certain embedded environments.

## 47.1 Writing JavaScript

Inline:

```html
<script>
    console.log("Hello World");
</script>
```

External:

```html
<script src="script.js" defer></script>
```

## 47.2 Comments

Single-line:

```javascript
// This is a comment
```

Multiline:

```javascript
/*
This is a
multiline comment.
*/
```

## 47.3 Console output

```javascript
console.log("Hello");

console.info("Information");

console.warn("Warning");

console.error("Error");

console.table([
    {name: "Alex", age: 15},
    {name: "Nathan", age: 13}
]);
```

---

# 48. VARIABLES AND DATA TYPES

## 48.1 Declaring variables

JavaScript has three common variable declaration keywords.

```javascript
var oldVariable = 10;

let variable = 20;

const constant = 30;
```

Differences:

| Keyword | Scope | Reassignable | Redeclarable in same scope |
|---|---|---|---|
| `var` | Function | Yes | Yes |
| `let` | Block | Yes | No |
| `const` | Block | No | No |

Prefer `const` by default and use `let` when reassignment is needed. Avoid `var` in modern code.

## 48.2 Data types

| Type | Example |
|---|---|
| String | `"Hello"` |
| Number | `100` |
| BigInt | `123n` |
| Boolean | `true` |
| Undefined | `undefined` |
| Null | `null` |
| Symbol | `Symbol("id")` |
| Object | `{name: "Nathan"}` |

Arrays and functions are also objects in JavaScript.

## 48.3 Checking types

```javascript
console.log(typeof "Hello");

console.log(typeof 100);

console.log(typeof true);
```

Output:

```text
string
number
boolean
```

Important:

```javascript
typeof null
```

Returns:

```text
object
```

This is a historical JavaScript quirk.

For arrays:

```javascript
Array.isArray([1, 2, 3]);
```

## 48.4 Undefined and null

```javascript
let value;

console.log(value); // undefined

let empty = null;

console.log(empty); // null
```

- `undefined` usually means a value has not been assigned.
- `null` represents an intentional absence of value.

---

# 49. OPERATORS

## 49.1 Arithmetic operators

| Operator | Meaning |
|---|---|
| `+` | Addition |
| `-` | Subtraction |
| `*` | Multiplication |
| `/` | Division |
| `%` | Remainder |
| `**` | Exponentiation |
| `++` | Increment |
| `--` | Decrement |

Example:

```javascript
let a = 10;
let b = 3;

console.log(a + b);
console.log(a - b);
console.log(a * b);
console.log(a / b);
console.log(a % b);
console.log(a ** b);
```

## 49.2 Comparison operators

| Operator | Meaning |
|---|---|
| `==` | Loose equality |
| `===` | Strict equality |
| `!=` | Loose inequality |
| `!==` | Strict inequality |
| `>` | Greater |
| `<` | Smaller |
| `>=` | Greater or equal |
| `<=` | Smaller or equal |

Example:

```javascript
console.log(5 == "5");  // true

console.log(5 === "5"); // false
```

Prefer strict equality (`===`) unless loose equality is specifically needed.

## 49.3 Logical operators

```javascript
&&  // AND

||  // OR

!   // NOT
```

Example:

```javascript
let age = 18;

if (age >= 18 && age < 100) {
    console.log("Valid adult age");
}
```

## 49.4 Assignment operators

```javascript
x = 10;

x += 5;

x -= 2;

x *= 3;

x /= 2;

x %= 2;

x **= 2;
```

## 49.5 Nullish coalescing

```javascript
let username = null;

let displayName = username ?? "Guest";
```

Uses the right-hand value only when the left-hand value is `null` or `undefined`.

## 49.6 Optional chaining

```javascript
let user = {
    profile: {
        name: "Nathan"
    }
};

console.log(user.profile?.name);
```

Avoids errors when an intermediate property is missing or nullish.

## 49.7 Ternary operator

```javascript
let age = 18;

let status = age >= 18 ? "Adult" : "Minor";
```

## 49.8 Bitwise operators

| Operator | Meaning |
|---|---|
| `&` | AND |
| `|` | OR |
| `^` | XOR |
| `~` | NOT |
| `<<` | Left shift |
| `>>` | Sign-propagating right shift |
| `>>>` | Zero-fill right shift |

Example:

```javascript
let a = 5;
let b = 3;

console.log(a & b);
console.log(a | b);
console.log(a ^ b);
```

---

# 50. STRINGS

Strings store text.

## 50.1 Creating strings

```javascript
let a = "Hello";

let b = 'World';

let c = `Hello World`;
```

## 50.2 Template literals

```javascript
let name = "Nathan";

let age = 13;

console.log(`My name is ${name} and I am ${age}.`);
```

Expressions:

```javascript
console.log(`Total: ${10 + 20}`);
```

## 50.3 String indexing

```javascript
let text = "JavaScript";

console.log(text[0]);

console.log(text[1]);

console.log(text.length);
```

## 50.4 String methods

| Method | Purpose |
|---|---|
| `.length` | String length property |
| `.toUpperCase()` | Uppercase |
| `.toLowerCase()` | Lowercase |
| `.trim()` | Remove surrounding whitespace |
| `.trimStart()` | Remove leading whitespace |
| `.trimEnd()` | Remove trailing whitespace |
| `.includes()` | Check substring |
| `.startsWith()` | Check beginning |
| `.endsWith()` | Check ending |
| `.indexOf()` | Find first position |
| `.lastIndexOf()` | Find last position |
| `.slice()` | Extract part |
| `.substring()` | Extract part |
| `.replace()` | Replace first matching string/pattern |
| `.replaceAll()` | Replace all matching strings |
| `.split()` | Convert to array |
| `.concat()` | Join strings |
| `.repeat()` | Repeat text |
| `.charAt()` | Get character |
| `.charCodeAt()` | Get UTF-16 code unit |
| `.padStart()` | Pad beginning |
| `.padEnd()` | Pad ending |
| `.match()` | Match regex |
| `.matchAll()` | Get all regex matches |
| `.search()` | Search regex |
| `.normalize()` | Unicode normalization |

Examples:

```javascript
let text = "  hello javascript  ";

console.log(text.trim());

console.log(text.toUpperCase());

console.log(text.includes("javascript"));

console.log(text.replace("hello", "welcome"));

console.log(text.slice(2, 7));
```

## 50.5 Splitting strings

```javascript
let fruits = "apple,banana,orange";

let result = fruits.split(",");

console.log(result);
```

## 50.6 Joining strings

```javascript
let words = ["Hello", "World"];

console.log(words.join(" "));
```

---

# 51. NUMBERS AND MATHEMATICS

## 51.1 Number conversion

```javascript
Number("123");

parseInt("123");

parseFloat("3.14");

String(100);

Boolean(1);
```

## 51.2 Number checks

```javascript
Number.isNaN(NaN);

Number.isFinite(100);

Number.isInteger(10);

Number.isSafeInteger(100);
```

## 51.3 Number formatting

```javascript
let number = 3.14159;

console.log(number.toFixed(2));

console.log(number.toPrecision(3));

console.log(number.toString());
```

## 51.4 Math object

| Function/property | Purpose |
|---|---|
| `Math.abs(x)` | Absolute value |
| `Math.round(x)` | Round |
| `Math.floor(x)` | Round down |
| `Math.ceil(x)` | Round up |
| `Math.trunc(x)` | Remove decimal |
| `Math.max()` | Maximum |
| `Math.min()` | Minimum |
| `Math.sqrt(x)` | Square root |
| `Math.cbrt(x)` | Cube root |
| `Math.pow(x,y)` | Power |
| `Math.random()` | Random number |
| `Math.sin(x)` | Sine |
| `Math.cos(x)` | Cosine |
| `Math.tan(x)` | Tangent |
| `Math.log(x)` | Natural logarithm |
| `Math.log10(x)` | Base-10 logarithm |
| `Math.exp(x)` | Exponential |
| `Math.sign(x)` | Sign |
| `Math.PI` | Pi |
| `Math.E` | Euler's number |

Examples:

```javascript
console.log(Math.sqrt(25));

console.log(Math.round(4.6));

console.log(Math.floor(4.9));

console.log(Math.max(10, 20, 30));

console.log(Math.min(10, 20, 30));
```

Random integer from 1 to 100:

```javascript
let randomNumber = Math.floor(Math.random() * 100) + 1;
```

---

# 52. CONDITIONS

## 52.1 if

```javascript
let age = 18;

if (age >= 18) {
    console.log("Adult");
}
```

## 52.2 if else

```javascript
if (age >= 18) {
    console.log("Adult");
} else {
    console.log("Minor");
}
```

## 52.3 else if

```javascript
let score = 85;

if (score >= 90) {
    console.log("A");
} else if (score >= 80) {
    console.log("B");
} else {
    console.log("C");
}
```

## 52.4 switch

```javascript
let command = "start";

switch (command) {

    case "start":
        console.log("Starting");
        break;

    case "stop":
        console.log("Stopping");
        break;

    default:
        console.log("Unknown command");

}
```

## 52.5 Truthy and falsy values

Falsy values include:

```javascript
false

0

-0

0n

""

null

undefined

NaN
```

Most other values are truthy, including empty arrays and empty objects.

Example:

```javascript
let username = "";

if (username) {
    console.log("Username exists");
} else {
    console.log("Empty username");
}
```

---

# 53. LOOPS

## 53.1 for loop

```javascript
for (let i = 0; i < 5; i++) {
    console.log(i);
}
```

Syntax:

```javascript
for (initialisation; condition; update) {
    // Code
}
```

## 53.2 while loop

```javascript
let i = 0;

while (i < 5) {
    console.log(i);

    i++;
}
```

## 53.3 do while

Runs at least once.

```javascript
let i = 0;

do {
    console.log(i);

    i++;

} while (i < 5);
```

## 53.4 for...of

Loops through iterable values.

```javascript
let fruits = ["Apple", "Banana", "Orange"];

for (let fruit of fruits) {
    console.log(fruit);
}
```

## 53.5 for...in

Loops through enumerable property keys.

```javascript
let person = {
    name: "Nathan",
    age: 13
};

for (let key in person) {
    console.log(key, person[key]);
}
```

For arrays, prefer `for...of` or array methods.

## 53.6 break

```javascript
for (let i = 0; i < 10; i++) {

    if (i === 5) {
        break;
    }

    console.log(i);
}
```

## 53.7 continue

```javascript
for (let i = 0; i < 10; i++) {

    if (i === 5) {
        continue;
    }

    console.log(i);
}
```

---

# 54. ARRAYS

Arrays store multiple values in an ordered collection.

## 54.1 Creating arrays

```javascript
let numbers = [1, 2, 3, 4];

let names = ["Alex", "Nathan"];

let mixed = [10, "Hello", true];
```

## 54.2 Accessing elements

```javascript
let fruits = ["Apple", "Banana", "Orange"];

console.log(fruits[0]);

console.log(fruits[1]);
```

Last element:

```javascript
console.log(fruits[fruits.length - 1]);
```

Modern alternative:

```javascript
console.log(fruits.at(-1));
```

## 54.3 Changing elements

```javascript
fruits[0] = "Mango";
```

## 54.4 Array properties

```javascript
console.log(fruits.length);
```

## 54.5 Array methods

| Method | Purpose |
|---|---|
| `.push()` | Add to end |
| `.pop()` | Remove from end |
| `.shift()` | Remove from beginning |
| `.unshift()` | Add to beginning |
| `.splice()` | Insert/remove elements |
| `.slice()` | Extract elements |
| `.concat()` | Combine arrays |
| `.join()` | Convert to string |
| `.indexOf()` | Find index |
| `.lastIndexOf()` | Find last index |
| `.includes()` | Check existence |
| `.reverse()` | Reverse in place |
| `.sort()` | Sort in place |
| `.toSorted()` | Return sorted copy |
| `.toReversed()` | Return reversed copy |
| `.fill()` | Fill with value |
| `.copyWithin()` | Copy array elements internally |
| `.flat()` | Flatten nested arrays |
| `.flatMap()` | Map and flatten |
| `.forEach()` | Execute for each element |
| `.map()` | Transform elements |
| `.filter()` | Select elements |
| `.reduce()` | Accumulate values |
| `.reduceRight()` | Accumulate from right |
| `.find()` | Find first matching element |
| `.findIndex()` | Find first matching index |
| `.findLast()` | Find last matching element |
| `.findLastIndex()` | Find last matching index |
| `.some()` | Check if any match |
| `.every()` | Check if all match |
| `.entries()` | Index-value iterator |
| `.keys()` | Index iterator |
| `.values()` | Value iterator |

Examples:

```javascript
let numbers = [1, 2, 3];

numbers.push(4);

numbers.pop();

numbers.unshift(0);

numbers.shift();

console.log(numbers);
```

## 54.6 Sorting arrays

```javascript
let numbers = [10, 5, 30, 2];

numbers.sort((a, b) => a - b);

console.log(numbers);
```

Descending:

```javascript
numbers.sort((a, b) => b - a);
```

Important: Default `.sort()` compares values as strings, so provide a comparator for numeric sorting.

## 54.7 Removing duplicates

```javascript
let numbers = [1, 2, 2, 3, 3];

let unique = [...new Set(numbers)];

console.log(unique);
```

## 54.8 Nested arrays

```javascript
let matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
];

console.log(matrix[0][0]);
```

---

# 55. OBJECTS

Objects store information using key-value pairs.

## 55.1 Creating objects

```javascript
let person = {
    name: "Nathan",

    age: 13,

    country: "Singapore"
};
```

## 55.2 Accessing properties

Dot notation:

```javascript
console.log(person.name);
```

Bracket notation:

```javascript
console.log(person["age"]);
```

## 55.3 Changing properties

```javascript
person.age = 14;
```

## 55.4 Adding properties

```javascript
person.school = "BPGHS";
```

## 55.5 Removing properties

```javascript
delete person.country;
```

## 55.6 Object methods

```javascript
let person = {
    name: "Nathan",

    greet() {
        console.log(`Hello, I am ${this.name}`);
    }
};

person.greet();
```

## 55.7 Object utility methods

```javascript
Object.keys(person);

Object.values(person);

Object.entries(person);

Object.assign({}, person);

Object.hasOwn(person, "name");

Object.freeze(person);

Object.seal(person);
```

## 55.8 Object destructuring

```javascript
let { name, age } = person;

console.log(name);
```

## 55.9 Nested objects

```javascript
let user = {
    name: "Nathan",

    profile: {
        age: 13,

        school: "BPGHS"
    }
};

console.log(user.profile.school);
```

---

# 56. FUNCTIONS

Functions are reusable blocks of JavaScript code.

## 56.1 Function declaration

```javascript
function greet() {
    console.log("Hello!");
}

greet();
```

## 56.2 Parameters

```javascript
function greet(name) {
    console.log(`Hello ${name}`);
}

greet("Nathan");
```

## 56.3 Multiple parameters

```javascript
function add(a, b) {
    return a + b;
}

console.log(add(10, 20));
```

## 56.4 Return

```javascript
function square(number) {
    return number * number;
}
```

## 56.5 Default parameters

```javascript
function greet(name = "Guest") {
    console.log(`Hello ${name}`);
}
```

## 56.6 Rest parameters

```javascript
function add(...numbers) {
    return numbers.reduce((a, b) => a + b, 0);
}

console.log(add(1, 2, 3, 4));
```

## 56.7 Function expressions

```javascript
const greet = function() {
    console.log("Hello");
};

greet();
```

## 56.8 Arrow functions

```javascript
const greet = () => {
    console.log("Hello");
};
```

Short version:

```javascript
const add = (a, b) => a + b;
```

Single parameter:

```javascript
const square = x => x * x;
```

Returning an object:

```javascript
const createUser = name => ({
    name: name
});
```

Arrow functions do not have their own `this` binding.

---

# 57. SCOPE AND CLOSURES

## 57.1 Global scope

```javascript
let username = "Nathan";

function greet() {
    console.log(username);
}
```

## 57.2 Function scope

```javascript
function example() {
    let secret = "Hello";
}
```

The variable is unavailable outside the function.

## 57.3 Block scope

```javascript
if (true) {
    let value = 10;

    const other = 20;
}
```

`let` and `const` are block-scoped.

## 57.4 Closures

A closure allows a function to remember variables from its outer scope.

```javascript
function counter() {

    let count = 0;

    return function() {

        count++;

        return count;

    };

}

const increment = counter();

console.log(increment());

console.log(increment());
```

Output:

```text
1
2
```

---

# 58. ARRAY METHODS IN DETAIL

These are among the most important JavaScript methods.

## 58.1 map()

Creates a new array by transforming each element.

```javascript
let numbers = [1, 2, 3];

let result = numbers.map(x => x * 2);

console.log(result);
```

Output:

```text
[2, 4, 6]
```

## 58.2 filter()

Creates a new array containing matching elements.

```javascript
let numbers = [1, 2, 3, 4, 5, 6];

let even = numbers.filter(x => x % 2 === 0);

console.log(even);
```

## 58.3 reduce()

Combines array elements into one result.

```javascript
let numbers = [1, 2, 3, 4];

let total = numbers.reduce((sum, number) => sum + number, 0);

console.log(total);
```

## 58.4 forEach()

Executes a function for each element.

```javascript
let names = ["Alex", "Nathan", "John"];

names.forEach(name => {
    console.log(name);
});
```

## 58.5 find()

Returns the first matching element.

```javascript
let numbers = [10, 20, 30, 40];

let result = numbers.find(x => x > 20);

console.log(result);
```

## 58.6 some()

Checks if at least one element matches.

```javascript
let numbers = [1, 3, 5, 8];

console.log(numbers.some(x => x % 2 === 0));
```

## 58.7 every()

Checks if all elements match.

```javascript
let numbers = [2, 4, 6];

console.log(numbers.every(x => x % 2 === 0));
```

---

# 59. DESTRUCTURING

Destructuring extracts values from arrays and objects.

## 59.1 Array destructuring

```javascript
let numbers = [10, 20, 30];

let [a, b, c] = numbers;

console.log(a);
```

Skipping elements:

```javascript
let [first, , third] = numbers;
```

Default values:

```javascript
let [x = 10, y = 20] = [5];
```

## 59.2 Object destructuring

```javascript
let person = {
    name: "Nathan",
    age: 13
};

let { name, age } = person;
```

Renaming:

```javascript
let { name: username } = person;
```

Default values:

```javascript
let { country = "Singapore" } = person;
```

## 59.3 Nested destructuring

```javascript
let user = {
    profile: {
        name: "Nathan"
    }
};

let {
    profile: {
        name
    }
} = user;
```

---

# 60. SPREAD AND REST OPERATORS

Both use `...`, but their purposes differ.

## 60.1 Spread operator

Expands iterable values.

```javascript
let a = [1, 2, 3];

let b = [...a, 4, 5];

console.log(b);
```

Combining arrays:

```javascript
let combined = [...a, ...b];
```

Copying objects:

```javascript
let person = {
    name: "Nathan"
};

let copy = {
    ...person,
    age: 13
};
```

Function arguments:

```javascript
let numbers = [10, 20, 30];

console.log(Math.max(...numbers));
```

Spread copies are shallow.

## 60.2 Rest operator

Collects remaining arguments.

```javascript
function add(...numbers) {
    return numbers.reduce((a, b) => a + b, 0);
}
```

Object destructuring:

```javascript
let {
    name,
    ...otherDetails
} = {
    name: "Nathan",
    age: 13,
    country: "Singapore"
};
```

---

# 61. CLASSES AND OBJECT-ORIENTED PROGRAMMING

## 61.1 Creating classes

```javascript
class Person {

    constructor(name, age) {

        this.name = name;

        this.age = age;

    }

    greet() {

        console.log(`Hello, I am ${this.name}`);

    }

}

const person = new Person("Nathan", 13);

person.greet();
```

## 61.2 Constructor

The `constructor()` method initialises new objects.

```javascript
class Player {

    constructor(health) {

        this.health = health;

    }

}
```

## 61.3 Instance methods

```javascript
class Calculator {

    add(a, b) {

        return a + b;

    }

}
```

## 61.4 Static methods

```javascript
class Calculator {

    static add(a, b) {

        return a + b;

    }

}

console.log(Calculator.add(10, 20));
```

## 61.5 Getters and setters

```javascript
class Person {

    constructor(age) {

        this._age = age;

    }

    get age() {

        return this._age;

    }

    set age(value) {

        if (value < 0) {

            throw new Error("Invalid age");

        }

        this._age = value;

    }

}
```

## 61.6 Private fields

```javascript
class BankAccount {

    #balance = 0;

    deposit(amount) {

        this.#balance += amount;

    }

    getBalance() {

        return this.#balance;

    }

}
```

Private fields cannot be accessed directly from outside the class.

---

# 62. INHERITANCE

A class can inherit from another class.

```javascript
class Animal {

    constructor(name) {

        this.name = name;

    }

    speak() {

        console.log("Animal sound");

    }

}

class Dog extends Animal {

    speak() {

        console.log("Woof!");

    }

}

const dog = new Dog("Buddy");

dog.speak();
```

## 62.1 super()

Calls the parent constructor or parent method.

```javascript
class Animal {

    constructor(name) {

        this.name = name;

    }

}

class Dog extends Animal {

    constructor(name, breed) {

        super(name);

        this.breed = breed;

    }

}
```

---

# 63. ERROR HANDLING

## 63.1 try and catch

```javascript
try {

    let result = 10 / 0;

    console.log(result);

} catch (error) {

    console.error(error);

}
```

JavaScript division by zero normally produces `Infinity`, not an exception.

## 63.2 finally

```javascript
try {

    console.log("Running");

} catch (error) {

    console.log("Error");

} finally {

    console.log("Finished");

}
```

## 63.3 throw

```javascript
function validateAge(age) {

    if (age < 0) {

        throw new Error("Age cannot be negative");

    }

}
```

## 63.4 Custom errors

```javascript
class LoginError extends Error {

    constructor(message) {

        super(message);

        this.name = "LoginError";

    }

}
```

---

# 64. DOM MANIPULATION

DOM stands for Document Object Model.

The DOM represents an HTML document as a tree of objects that JavaScript can access and modify.

Example HTML:

```html
<h1 id="title">Hello</h1>
```

JavaScript:

```javascript
const title = document.getElementById("title");

title.textContent = "Welcome!";
```

## 64.1 DOM object hierarchy

```text
window
  |
  document
  |
  html
  |
  +-- head
  |
  +-- body
       |
       +-- h1
       |
       +-- p
       |
       +-- button
```

## 64.2 Selecting elements

| Method | Purpose |
|---|---|
| `getElementById()` | Select by ID |
| `getElementsByClassName()` | Select by class |
| `getElementsByTagName()` | Select by tag |
| `querySelector()` | First matching CSS selector |
| `querySelectorAll()` | All matching CSS selectors |

Examples:

```javascript
document.getElementById("title");

document.getElementsByClassName("card");

document.getElementsByTagName("p");

document.querySelector(".card");

document.querySelectorAll("p");
```

## 64.3 Changing text

```javascript
const title = document.querySelector("h1");

title.textContent = "New Heading";
```

## 64.4 Changing HTML

```javascript
const container = document.querySelector(".container");

container.innerHTML = "<h1>Hello</h1>";
```

Important: Never place untrusted user input directly into `innerHTML`. Use `textContent` or safely constructed DOM nodes instead.

## 64.5 Changing CSS

```javascript
const box = document.querySelector(".box");

box.style.backgroundColor = "red";

box.style.color = "white";

box.style.padding = "20px";
```

## 64.6 Changing classes

```javascript
const box = document.querySelector(".box");

box.classList.add("active");

box.classList.remove("hidden");

box.classList.toggle("dark");

box.classList.contains("active");
```

## 64.7 Attributes

```javascript
const image = document.querySelector("img");

image.setAttribute("src", "new-image.png");

image.getAttribute("src");

image.removeAttribute("alt");

image.hasAttribute("src");
```

## 64.8 Creating elements

```javascript
const paragraph = document.createElement("p");

paragraph.textContent = "New paragraph";

document.body.appendChild(paragraph);
```

## 64.9 Removing elements

```javascript
const element = document.querySelector(".box");

element.remove();
```

## 64.10 Appending elements

```javascript
container.appendChild(element);
```

Modern alternative:

```javascript
container.append(element);
```

## 64.11 Inserting elements

```javascript
container.prepend(element);
```

```javascript
container.before(element);
```

```javascript
container.after(element);
```

## 64.12 Cloning elements

```javascript
const clone = element.cloneNode(true);

container.appendChild(clone);
```

`true` also clones descendants.

---

# 65. DOM EVENTS

Events allow JavaScript to respond to user interactions and browser activity.

## 65.1 Common events

| Event | Purpose |
|---|---|
| `click` | Mouse click or equivalent activation |
| `dblclick` | Double-click |
| `mousedown` | Mouse button pressed |
| `mouseup` | Mouse button released |
| `mousemove` | Mouse movement |
| `mouseover` | Pointer enters element or descendant |
| `mouseout` | Pointer leaves element or descendant |
| `mouseenter` | Pointer enters element |
| `mouseleave` | Pointer leaves element |
| `keydown` | Key pressed |
| `keyup` | Key released |
| `input` | Input value changes |
| `change` | Value committed or changed |
| `submit` | Form submitted |
| `focus` | Element receives focus |
| `blur` | Element loses focus |
| `load` | Resource loaded |
| `DOMContentLoaded` | HTML parsed |
| `scroll` | Scrolling |
| `resize` | Viewport resized |
| `dragstart` | Drag begins |
| `dragover` | Drag passes over target |
| `drop` | Item dropped |
| `touchstart` | Touch begins |
| `touchend` | Touch ends |
| `pointerdown` | Pointer pressed |
| `pointerup` | Pointer released |

## 65.2 Inline event handler

```html
<button onclick="alert('Hello')">
    Click Me
</button>
```

This works, but event listeners are usually better for maintainability and security.

## 65.3 addEventListener()

```javascript
const button = document.querySelector("button");

button.addEventListener("click", function() {

    alert("Button clicked!");

});
```

Arrow function:

```javascript
button.addEventListener("click", () => {

    console.log("Clicked");

});
```

## 65.4 Removing event listeners

```javascript
function handleClick() {

    console.log("Clicked");

}

button.addEventListener("click", handleClick);

button.removeEventListener("click", handleClick);
```

The same function reference must be used to remove the listener.

## 65.5 Event object

```javascript
button.addEventListener("click", event => {

    console.log(event);

    console.log(event.target);

});
```

## 65.6 Prevent default behaviour

```javascript
form.addEventListener("submit", event => {

    event.preventDefault();

    console.log("Submission intercepted");

});
```

## 65.7 Event propagation

Events can travel through the DOM.

- Capturing phase
- Target phase
- Bubbling phase

Stop propagation:

```javascript
event.stopPropagation();
```

Prevent default:

```javascript
event.preventDefault();
```

These do different things.

## 65.8 Event delegation

Attach one event listener to a parent instead of many children.

```javascript
document.querySelector("#list").addEventListener("click", event => {

    if (event.target.matches("button")) {

        console.log("Button clicked");

    }

});
```

Useful for dynamically created elements.

---

# 66. FORMS AND VALIDATION

## 66.1 Reading input values

HTML:

```html
<input id="username" type="text">

<button id="submit">Submit</button>
```

JavaScript:

```javascript
const input = document.querySelector("#username");

const button = document.querySelector("#submit");

button.addEventListener("click", () => {

    console.log(input.value);

});
```

## 66.2 Listening for input changes

```javascript
input.addEventListener("input", () => {

    console.log(input.value);

});
```

## 66.3 Form submission

```javascript
const form = document.querySelector("form");

form.addEventListener("submit", event => {

    event.preventDefault();

    const formData = new FormData(form);

    console.log(formData.get("username"));

});
```

## 66.4 Checking validity

```javascript
const email = document.querySelector("#email");

console.log(email.validity.valid);

console.log(email.checkValidity());

console.log(email.validationMessage);
```

## 66.5 Custom validation

```javascript
const input = document.querySelector("#username");

if (input.value.length < 3) {

    input.setCustomValidity("Minimum 3 characters");

} else {

    input.setCustomValidity("");

}
```

## 66.6 FormData

```javascript
const data = new FormData(form);

const entries = Object.fromEntries(data.entries());

console.log(entries);
```

---

# 67. TIMERS AND INTERVALS

## 67.1 setTimeout()

Executes code after a delay.

```javascript
setTimeout(() => {

    console.log("Executed after 2 seconds");

}, 2000);
```

## 67.2 clearTimeout()

```javascript
const timer = setTimeout(() => {

    console.log("Hello");

}, 5000);

clearTimeout(timer);
```

## 67.3 setInterval()

Repeatedly executes code.

```javascript
const interval = setInterval(() => {

    console.log("Repeating");

}, 1000);
```

## 67.4 clearInterval()

```javascript
clearInterval(interval);
```

## 67.5 Creating a countdown

```javascript
let seconds = 10;

const timer = setInterval(() => {

    console.log(seconds);

    seconds--;

    if (seconds < 0) {

        clearInterval(timer);

        console.log("Finished");

    }

}, 1000);
```

Timers are not exact clocks. Use timestamps when accurate elapsed-time calculations matter.

---

# 68. LOCAL STORAGE AND SESSION STORAGE

Web Storage allows websites to save small amounts of data in the browser.

## 68.1 localStorage

Data persists across browser sessions until removed.

Save:

```javascript
localStorage.setItem("username", "Nathan");
```

Retrieve:

```javascript
let username = localStorage.getItem("username");
```

Remove:

```javascript
localStorage.removeItem("username");
```

Clear:

```javascript
localStorage.clear();
```

## 68.2 sessionStorage

Data is generally retained for the lifetime of the browser tab's page session.

```javascript
sessionStorage.setItem("token", "12345");

sessionStorage.getItem("token");

sessionStorage.removeItem("token");
```

## 68.3 Storing objects

Storage values are strings.

Convert objects using JSON:

```javascript
const user = {
    name: "Nathan",
    age: 13
};

localStorage.setItem("user", JSON.stringify(user));
```

Retrieve:

```javascript
const savedUser = JSON.parse(
    localStorage.getItem("user")
);
```

Storage is not a secure place for passwords, session secrets or sensitive data. Users can inspect and modify it.

---

# 69. JSON

JSON stands for JavaScript Object Notation.

It is widely used for exchanging data.

## 69.1 JavaScript object

```javascript
const user = {
    name: "Nathan",
    age: 13
};
```

## 69.2 Convert to JSON

```javascript
const json = JSON.stringify(user);

console.log(json);
```

## 69.3 Convert JSON to object

```javascript
const object = JSON.parse(json);

console.log(object.name);
```

## 69.4 Pretty JSON

```javascript
JSON.stringify(user, null, 4);
```

## 69.5 Handling JSON errors

```javascript
try {

    const data = JSON.parse("{invalid}");

} catch (error) {

    console.error("Invalid JSON");

}
```

---

# 70. FETCH API

The Fetch API allows JavaScript to communicate with servers.

## 70.1 GET request

```javascript
fetch("https://jsonplaceholder.typicode.com/users")
    .then(response => {

        if (!response.ok) {
            throw new Error("HTTP error: " + response.status);
        }

        return response.json();

    })
    .then(data => {

        console.log(data);

    })
    .catch(error => {

        console.error(error);

    });
```

## 70.2 POST request

```javascript
fetch("https://jsonplaceholder.typicode.com/posts", {

    method: "POST",

    headers: {
        "Content-Type": "application/json"
    },

    body: JSON.stringify({

        title: "Hello",

        body: "My first post",

        userId: 1

    })

})
.then(response => response.json())
.then(data => console.log(data));
```

## 70.3 Common fetch options

| Option | Purpose |
|---|---|
| `method` | HTTP method |
| `headers` | Request headers |
| `body` | Request body |
| `mode` | Request mode |
| `credentials` | Credential behaviour |
| `cache` | Cache behaviour |
| `redirect` | Redirect behaviour |
| `signal` | Abort signal |

## 70.4 Important HTTP status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 301 | Permanent redirect |
| 302 | Temporary redirect |
| 304 | Not modified |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 405 | Method not allowed |
| 409 | Conflict |
| 429 | Too many requests |
| 500 | Internal server error |
| 502 | Bad gateway |
| 503 | Service unavailable |
| 504 | Gateway timeout |

Fetch normally rejects on network-level failures, not simply because the server returned a 404 or 500. Check `response.ok`.

---

# 71. PROMISES

Promises represent operations that may complete in the future.

## 71.1 Promise states

- Pending
- Fulfilled
- Rejected

## 71.2 Creating a promise

```javascript
const promise = new Promise((resolve, reject) => {

    const success = true;

    if (success) {

        resolve("Success");

    } else {

        reject("Failed");

    }

});
```

## 71.3 then()

```javascript
promise.then(result => {

    console.log(result);

});
```

## 71.4 catch()

```javascript
promise.catch(error => {

    console.error(error);

});
```

## 71.5 finally()

```javascript
promise.finally(() => {

    console.log("Finished");

});
```

## 71.6 Promise.all()

Waits for all promises to fulfil.

```javascript
Promise.all([
    fetch("/api/users"),
    fetch("/api/posts")
])
.then(results => console.log(results));
```

Rejects if one input promise rejects.

## 71.7 Promise.allSettled()

Waits for every promise to settle.

```javascript
Promise.allSettled([
    Promise.resolve("Success"),
    Promise.reject("Error")
])
.then(results => console.log(results));
```

## 71.8 Promise.race()

Settles with the first settled promise.

```javascript
Promise.race([
    promise1,
    promise2
]);
```

## 71.9 Promise.any()

Fulfils with the first fulfilled promise.

```javascript
Promise.any([
    promise1,
    promise2
]);
```

---

# 72. ASYNC AND AWAIT

Async functions make asynchronous code easier to read.

## 72.1 async

```javascript
async function greet() {

    return "Hello";

}
```

An async function always returns a Promise.

## 72.2 await

```javascript
async function getData() {

    const response = await fetch("/api/data");

    const data = await response.json();

    console.log(data);

}
```

## 72.3 Error handling

```javascript
async function getData() {

    try {

        const response = await fetch("/api/data");

        if (!response.ok) {
            throw new Error("Request failed");
        }

        const data = await response.json();

        console.log(data);

    } catch (error) {

        console.error(error);

    }

}
```

## 72.4 Parallel operations

```javascript
async function loadData() {

    const [users, posts] = await Promise.all([

        fetch("/api/users"),

        fetch("/api/posts")

    ]);

    console.log(users, posts);

}
```

Use `Promise.all()` when independent operations can run concurrently.

---

# 73. JAVASCRIPT MODULES

Modules divide code into reusable files.

## 73.1 Exporting

File: `math.js`

```javascript
export function add(a, b) {

    return a + b;

}

export const PI = 3.14159;
```

## 73.2 Importing

File: `main.js`

```javascript
import { add, PI } from "./math.js";

console.log(add(10, 20));

console.log(PI);
```

## 73.3 Default export

```javascript
export default function greet() {

    console.log("Hello");

}
```

Import:

```javascript
import greet from "./greet.js";
```

## 73.4 Renaming imports

```javascript
import { add as sum } from "./math.js";
```

## 73.5 HTML module script

```html
<script type="module" src="main.js"></script>
```

Modules are automatically deferred and have their own scope.

---

# 74. REGULAR EXPRESSIONS

Regex searches and matches text patterns.

## 74.1 Creating regex

```javascript
const pattern = /hello/i;
```

Flags:

| Flag | Meaning |
|---|---|
| `g` | Global |
| `i` | Case-insensitive |
| `m` | Multiline |
| `s` | Dot matches line terminators |
| `u` | Unicode-aware |
| `y` | Sticky |
| `d` | Match indices |

## 74.2 Regex symbols

| Symbol | Meaning |
|---|---|
| `.` | Any character except line terminators by default |
| `^` | Start |
| `$` | End |
| `*` | Zero or more |
| `+` | One or more |
| `?` | Optional |
| `{n}` | Exactly n |
| `{n,m}` | Between n and m |
| `[]` | Character set |
| `[^]` | Negated character set |
| `\d` | Digit |
| `\D` | Non-digit |
| `\w` | Word character |
| `\W` | Non-word character |
| `\s` | Whitespace |
| `\S` | Non-whitespace |
| `()` | Capturing group |
| `(?:)` | Non-capturing group |
| `|` | OR |
| `\b` | Word boundary |

## 74.3 test()

```javascript
const pattern = /^\d+$/;

console.log(pattern.test("123"));
```

## 74.4 match()

```javascript
const text = "I have 123 apples";

console.log(text.match(/\d+/));
```

## 74.5 replace()

```javascript
let text = "Hello World";

console.log(text.replace("World", "Nathan"));
```

## 74.6 split()

```javascript
let text = "apple,banana,orange";

console.log(text.split(","));
```

---

# 75. BROWSER APIs

JavaScript has access to many browser APIs.

## 75.1 Window API

```javascript
window.innerWidth;

window.innerHeight;

window.location.href;

window.location.reload();

window.history.back();

window.history.forward();
```

## 75.2 Location API

```javascript
console.log(location.href);

console.log(location.hostname);

console.log(location.pathname);

console.log(location.protocol);

console.log(location.search);

console.log(location.hash);
```

Navigate:

```javascript
location.href = "https://example.com";
```

## 75.3 Navigator API

```javascript
console.log(navigator.language);

console.log(navigator.onLine);

console.log(navigator.userAgent);
```

Some browser properties may be restricted or unreliable as device-identification methods.

## 75.4 Clipboard API

Copy:

```javascript
await navigator.clipboard.writeText("Hello World");
```

Read:

```javascript
const text = await navigator.clipboard.readText();
```

Clipboard access generally requires a secure context and user permission or activation.

## 75.5 Geolocation API

```javascript
navigator.geolocation.getCurrentPosition(position => {

    console.log(position.coords.latitude);

    console.log(position.coords.longitude);

});
```

Requires user permission and a secure context in normal browser use.

## 75.6 Fullscreen API

```javascript
document.documentElement.requestFullscreen();
```

Exit:

```javascript
document.exitFullscreen();
```

Fullscreen requests generally need user activation.

## 75.7 Notifications API

```javascript
const permission = await Notification.requestPermission();

if (permission === "granted") {

    new Notification("Hello!");

}
```

Requires user permission and a secure context.

## 75.8 Intersection Observer

Detects when an element enters or leaves a visible area.

```javascript
const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            console.log("Element visible");

        }

    });

});

observer.observe(document.querySelector(".box"));
```

Useful for:
- Lazy loading
- Scroll animations
- Visibility detection

## 75.9 Mutation Observer

Detects changes to the DOM.

```javascript
const observer = new MutationObserver(mutations => {

    console.log(mutations);

});

observer.observe(document.body, {

    childList: true,

    subtree: true,

    attributes: true

});
```

## 75.10 Resize Observer

Detects element size changes.

```javascript
const observer = new ResizeObserver(entries => {

    for (const entry of entries) {

        console.log(entry.contentRect.width);

    }

});

observer.observe(document.querySelector(".container"));
```

---

# 76. CANVAS API

Canvas allows JavaScript to draw graphics.

HTML:

```html
<canvas id="canvas" width="600" height="400"></canvas>
```

JavaScript:

```javascript
const canvas = document.querySelector("#canvas");

const ctx = canvas.getContext("2d");
```

## 76.1 Draw rectangles

```javascript
ctx.fillStyle = "red";

ctx.fillRect(50, 50, 100, 100);
```

Outline:

```javascript
ctx.strokeStyle = "blue";

ctx.strokeRect(200, 50, 100, 100);
```

Clear:

```javascript
ctx.clearRect(0, 0, 600, 400);
```

## 76.2 Draw circles

```javascript
ctx.beginPath();

ctx.arc(100, 100, 50, 0, Math.PI * 2);

ctx.fillStyle = "blue";

ctx.fill();
```

## 76.3 Draw lines

```javascript
ctx.beginPath();

ctx.moveTo(50, 50);

ctx.lineTo(200, 200);

ctx.stroke();
```

## 76.4 Draw text

```javascript
ctx.font = "30px Arial";

ctx.fillStyle = "black";

ctx.fillText("Hello", 50, 100);
```

## 76.5 Draw images

```javascript
const image = new Image();

image.src = "image.png";

image.onload = () => {

    ctx.drawImage(image, 0, 0, 200, 200);

};
```

## 76.6 Canvas animation

```javascript
let x = 0;

function animate() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillRect(x, 100, 50, 50);

    x += 2;

    if (x > canvas.width) {
        x = -50;
    }

    requestAnimationFrame(animate);

}

animate();
```

---

# 77. WEBSOCKETS

WebSockets provide persistent two-way communication between browser and server.

```javascript
const socket = new WebSocket("wss://example.com/socket");
```

Connection:

```javascript
socket.addEventListener("open", () => {

    console.log("Connected");

});
```

Send:

```javascript
socket.send("Hello Server");
```

Receive:

```javascript
socket.addEventListener("message", event => {

    console.log(event.data);

});
```

Error:

```javascript
socket.addEventListener("error", error => {

    console.error(error);

});
```

Close:

```javascript
socket.close();
```

WebSockets are useful for:
- Chat applications
- Multiplayer games
- Live dashboards
- Real-time notifications
- Collaborative applications

---

# 78. WEB WORKERS

Web Workers execute JavaScript in background threads.

Main JavaScript:

```javascript
const worker = new Worker("worker.js");

worker.postMessage("Hello");

worker.onmessage = event => {

    console.log(event.data);

};
```

Worker file:

```javascript
self.onmessage = event => {

    console.log(event.data);

    self.postMessage("Message received");

};
```

Terminate:

```javascript
worker.terminate();
```

Workers cannot directly manipulate the main document DOM.

---

# 79. JAVASCRIPT SECURITY

Security is extremely important when creating websites.

## 79.1 Avoid unsafe innerHTML

Unsafe:

```javascript
element.innerHTML = userInput;
```

Safer for plain text:

```javascript
element.textContent = userInput;
```

## 79.2 Avoid eval()

Dangerous:

```javascript
eval(userInput);
```

Never execute arbitrary user-provided code in a normal application.

## 79.3 Validate user input

```javascript
function validateUsername(name) {

    return /^[a-zA-Z0-9_]{3,20}$/.test(name);

}
```

## 79.4 HTTPS

Use HTTPS for websites and APIs that handle sensitive information.

## 79.5 API keys

Do not put secret API keys in frontend JavaScript.

Anything delivered to a browser can be inspected by users.

Keep secret keys on a backend server.

## 79.6 Authentication

Never rely on frontend checks alone for access control.

A hidden admin button is not security.

The server must independently verify permissions.

---

# 80. DEBUGGING AND TESTING

## 80.1 Console debugging

```javascript
console.log("Debug");

console.warn("Warning");

console.error("Error");

console.table(data);
```

## 80.2 Breakpoints

```javascript
debugger;
```

Pauses execution when developer tools are open.

## 80.3 Try/catch debugging

```javascript
try {

    riskyOperation();

} catch (error) {

    console.error(error);

}
```

## 80.4 Performance timing

```javascript
console.time("operation");

for (let i = 0; i < 100000; i++) {

    // Work

}

console.timeEnd("operation");
```

## 80.5 Assertions

```javascript
console.assert(10 > 5, "Condition failed");
```

## 80.6 Testing

Example using Node.js built-in test runner:

```javascript
import test from "node:test";

import assert from "node:assert/strict";

function add(a, b) {
    return a + b;
}

test("addition works", () => {

    assert.equal(add(2, 3), 5);

});
```

Run:

```bash
node --test
```

---

# PART IV: COMBINED WEB DEVELOPMENT

# 81. CONNECTING HTML, CSS AND JAVASCRIPT

A normal website uses separate files.

Project structure:

```text
MyWebsite/
│
├── index.html
│
├── css/
│   └── style.css
│
├── js/
│   └── script.js
│
└── assets/
    ├── images/
    ├── icons/
    └── fonts/
```

HTML:

```html
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>My Website</title>

    <link rel="stylesheet" href="css/style.css">

    <script src="js/script.js" defer></script>

</head>

<body>

    <h1 id="title">Hello World</h1>

    <button id="button">Click Me</button>

</body>

</html>
```

CSS:

```css
body {
    background: #111;

    color: white;

    font-family: Arial, sans-serif;

    text-align: center;

    padding: 50px;
}

button {
    background: blue;

    color: white;

    padding: 12px 24px;

    border: none;

    cursor: pointer;
}
```

JavaScript:

```javascript
const button = document.querySelector("#button");

const title = document.querySelector("#title");

button.addEventListener("click", () => {

    title.textContent = "Button Clicked!";

});
```

---

# 82. CREATING DYNAMIC WEBSITE COMPONENTS

## 82.1 Dynamic cards

HTML:

```html
<div id="container"></div>
```

JavaScript:

```javascript
const container = document.querySelector("#container");

const users = [
    {
        name: "Nathan",
        age: 13
    },
    {
        name: "Alex",
        age: 15
    }
];

users.forEach(user => {

    const card = document.createElement("div");

    const heading = document.createElement("h2");

    const paragraph = document.createElement("p");

    heading.textContent = user.name;

    paragraph.textContent = `Age: ${user.age}`;

    card.append(heading, paragraph);

    card.classList.add("card");

    container.appendChild(card);

});
```

CSS:

```css
.card {
    background: #222;

    padding: 20px;

    margin: 10px;

    border-radius: 10px;
}
```

## 82.2 Search functionality

HTML:

```html
<input id="search" placeholder="Search...">

<ul id="results"></ul>
```

JavaScript:

```javascript
const search = document.querySelector("#search");

const results = document.querySelector("#results");

const names = ["Nathan", "Alex", "John", "Michael"];

function displayResults(query) {

    results.replaceChildren();

    const filtered = names.filter(name =>
        name.toLowerCase().includes(query.toLowerCase())
    );

    filtered.forEach(name => {

        const li = document.createElement("li");

        li.textContent = name;

        results.appendChild(li);

    });

}

search.addEventListener("input", () => {

    displayResults(search.value);

});

displayResults("");
```

## 82.3 Dark and light mode

HTML:

```html
<button id="themeButton">Toggle Theme</button>
```

CSS:

```css
body {
    background: white;

    color: black;
}

body.dark {
    background: #111;

    color: white;
}
```

JavaScript:

```javascript
const button = document.querySelector("#themeButton");

button.addEventListener("click", () => {

    document.body.classList.toggle("dark");

});
```

## 82.4 Persistent theme

```javascript
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {

    document.body.classList.add("dark");

}

button.addEventListener("click", () => {

    document.body.classList.toggle("dark");

    const theme = document.body.classList.contains("dark")
        ? "dark"
        : "light";

    localStorage.setItem("theme", theme);

});
```

---

# 83. COMMON WEBSITE FUNCTIONS

## 83.1 Show and hide elements

```javascript
element.style.display = "none";

element.style.display = "block";
```

## 83.2 Toggle visibility

```javascript
element.classList.toggle("hidden");
```

## 83.3 Update text

```javascript
element.textContent = "New text";
```

## 83.4 Update images

```javascript
image.src = "new-image.jpg";
```

## 83.5 Change page title

```javascript
document.title = "New Page Title";
```

## 83.6 Reload page

```javascript
location.reload();
```

## 83.7 Navigate to another page

```javascript
location.href = "about.html";
```

## 83.8 Scroll to an element

```javascript
document.querySelector("#section").scrollIntoView({
    behavior: "smooth"
});
```

## 83.9 Copy text

```javascript
navigator.clipboard.writeText("Copied text");
```

## 83.10 Download a text file

```javascript
const blob = new Blob(
    ["Hello World"],
    {type: "text/plain"}
);

const url = URL.createObjectURL(blob);

const link = document.createElement("a");

link.href = url;

link.download = "file.txt";

link.click();

URL.revokeObjectURL(url);
```

## 83.11 Generate a random ID

```javascript
const id = crypto.randomUUID();

console.log(id);
```

---

# 84. USEFUL BROWSER DEVELOPER TOOLS

Most modern browsers include developer tools.

Open using:

```text
F12
```

Or:

```text
Ctrl + Shift + I
```

On macOS:

```text
Cmd + Option + I
```

## 84.1 Elements panel

Used to:
- Inspect HTML.
- Modify HTML.
- Edit CSS.
- Check computed styles.
- Inspect element dimensions.
- Debug layout.

## 84.2 Console panel

Used to:
- Execute JavaScript.
- View errors.
- Print debugging information.
- Inspect variables.

## 84.3 Network panel

Used to:
- Inspect HTTP requests.
- Check API responses.
- Monitor file loading.
- Inspect request headers.
- Check status codes.
- Identify slow resources.

## 84.4 Sources panel

Used to:
- Inspect JavaScript files.
- Set breakpoints.
- Debug execution.
- Step through code.

## 84.5 Application panel

Used to inspect:
- Local storage.
- Session storage.
- Cookies.
- IndexedDB.
- Cache storage.
- Service workers.

## 84.6 Responsive mode

Used to simulate:
- Mobile screens.
- Tablet screens.
- Desktop screens.
- Different viewport dimensions.

---

# 85. PERFORMANCE OPTIMISATION

## 85.1 Minimise unnecessary DOM changes

Avoid repeatedly rebuilding large sections of the page.

## 85.2 Lazy-load images

```html
<img src="image.jpg" loading="lazy" alt="Image">
```

## 85.3 Defer JavaScript

```html
<script src="script.js" defer></script>
```

## 85.4 Minimise CSS and JavaScript files

Use build tools when a project becomes large.

## 85.5 Avoid unnecessary event listeners

Use event delegation for large dynamic collections.

## 85.6 Use requestAnimationFrame

For visual animations:

```javascript
function animate() {

    // Update visual state.

    requestAnimationFrame(animate);

}

requestAnimationFrame(animate);
```

## 85.7 Avoid layout thrashing

Avoid repeatedly mixing layout reads and writes.

For example, reading an element's dimensions after changing its styles repeatedly can force expensive layout calculations.

## 85.8 Use efficient selectors

Prefer clear and targeted selectors.

## 85.9 Compress assets

Optimise:
- Images.
- Fonts.
- JavaScript.
- CSS.
- Videos.

---

# 86. ACCESSIBILITY

Important accessibility practices:

1. Use semantic HTML.
2. Provide alternative text for meaningful images.
3. Use labels for form fields.
4. Ensure keyboard navigation.
5. Maintain sufficient colour contrast.
6. Provide visible focus indicators.
7. Avoid relying on colour alone.
8. Use appropriate heading hierarchy.
9. Make buttons and links understandable.
10. Respect reduced-motion preferences.

Example:

```html
<button
    type="button"
    aria-label="Open navigation menu"
    aria-expanded="false">

    Menu

</button>
```

---

# 87. DEPLOYMENT AND HOSTING

A website can be hosted using several services.

Common static hosting platforms include:

- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel

## 87.1 GitHub Pages

Typical workflow:

1. Create a GitHub repository.
2. Upload HTML, CSS and JavaScript.
3. Open repository settings.
4. Navigate to Pages.
5. Select a deployment source.
6. Publish the website.

## 87.2 Local testing

You can open `index.html` directly in a browser for simple projects.

However, some features require an HTTP server, especially:
- JavaScript modules.
- Fetching local files.
- Certain browser APIs.
- Service workers.

A simple local server with Python:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## 87.3 Important distinction

Static hosting can serve frontend files, but it does not automatically provide:
- Databases.
- Private server-side code.
- Secure authentication.
- Backend API processing.
- Server-side file storage.

These require a backend or external service.

---

# 88. COMMON ERRORS

## HTML errors

| Problem | Likely cause |
|---|---|
| Images not loading | Incorrect `src` |
| CSS not working | Incorrect stylesheet path |
| JavaScript not running | Incorrect script path or JavaScript error |
| Broken layout | Invalid nesting or CSS issue |
| Missing mobile styling | Missing viewport metadata |

## CSS errors

| Problem | Likely cause |
|---|---|
| CSS not applying | Wrong selector |
| Property ignored | Invalid value |
| Element not centered | Incorrect layout settings |
| z-index not working | Stacking context |
| Flexbox behaving strangely | Incorrect axis or sizing |
| Overflow | Fixed dimensions or missing wrapping |
| Animation not running | Incorrect keyframes or animation name |

## JavaScript errors

| Error | Meaning |
|---|---|
| `ReferenceError` | Variable or function unavailable |
| `TypeError` | Invalid operation for a value |
| `SyntaxError` | Invalid syntax |
| `RangeError` | Value outside allowed range |
| `URIError` | Invalid URI operation |
| `ReferenceError: Cannot access before initialization` | Accessing a lexical binding before initialisation |
| `Cannot read properties of null` | Attempted property access on null |
| `is not a function` | Called something that is not callable |

## Common mistakes

Incorrect:

```javascript
if (x = 10) {
    console.log("Hello");
}
```

Correct:

```javascript
if (x === 10) {
    console.log("Hello");
}
```

Incorrect:

```javascript
const numbers = [1, 2, 3];

numbers = [4, 5];
```

Correct:

```javascript
let numbers = [1, 2, 3];

numbers = [4, 5];
```

Or modify the existing array:

```javascript
const numbers = [1, 2, 3];

numbers.push(4);
```

Remember that `const` prevents reassignment of the variable, not mutation of the object it references.

---

# 89. COMPLETE EXAMPLE PROJECTS

## 89.1 Interactive counter

HTML:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">

    <title>Counter</title>

    <link rel="stylesheet" href="style.css">

    <script src="script.js" defer></script>
</head>

<body>

    <h1 id="counter">0</h1>

    <button id="decrease">-</button>

    <button id="reset">Reset</button>

    <button id="increase">+</button>

</body>

</html>
```

CSS:

```css
body {
    background: #111;

    color: white;

    text-align: center;

    font-family: Arial;

    padding: 50px;
}

button {
    padding: 15px 25px;

    cursor: pointer;

    border: none;

    border-radius: 5px;
}
```

JavaScript:

```javascript
let count = 0;

const counter = document.querySelector("#counter");

function update() {

    counter.textContent = count;

}

document.querySelector("#increase").addEventListener("click", () => {

    count++;

    update();

});

document.querySelector("#decrease").addEventListener("click", () => {

    count--;

    update();

});

document.querySelector("#reset").addEventListener("click", () => {

    count = 0;

    update();

});
```

## 89.2 To-do list

HTML:

```html
<input id="taskInput" placeholder="Enter task">

<button id="addTask">Add</button>

<ul id="taskList"></ul>
```

JavaScript:

```javascript
const input = document.querySelector("#taskInput");

const list = document.querySelector("#taskList");

document.querySelector("#addTask").addEventListener("click", () => {

    const text = input.value.trim();

    if (!text) return;

    const item = document.createElement("li");

    const label = document.createElement("span");

    const remove = document.createElement("button");

    label.textContent = text;

    remove.textContent = "Delete";

    remove.addEventListener("click", () => {

        item.remove();

    });

    item.append(label, remove);

    list.appendChild(item);

    input.value = "";

});
```

## 89.3 Live digital clock

HTML:

```html
<h1 id="clock"></h1>
```

JavaScript:

```javascript
function updateClock() {

    const now = new Date();

    const time = now.toLocaleTimeString();

    document.querySelector("#clock").textContent = time;

}

updateClock();

setInterval(updateClock, 1000);
```

## 89.4 API-powered webpage

HTML:

```html
<button id="load">Load Data</button>

<div id="output"></div>
```

JavaScript:

```javascript
const button = document.querySelector("#load");

const output = document.querySelector("#output");

button.addEventListener("click", async () => {

    output.textContent = "Loading...";

    try {

        const response = await fetch(
            "https://jsonplaceholder.typicode.com/posts/1"
        );

        if (!response.ok) {
            throw new Error("Failed to load data");
        }

        const data = await response.json();

        const heading = document.createElement("h2");

        const paragraph = document.createElement("p");

        heading.textContent = data.title;

        paragraph.textContent = data.body;

        output.replaceChildren(heading, paragraph);

    } catch (error) {

        output.textContent = error.message;

    }

});
```

## 89.5 Simple animated loading screen

HTML:

```html
<div class="loader"></div>
```

CSS:

```css
.loader {
    width: 50px;

    height: 50px;

    border: 5px solid #333;

    border-top-color: white;

    border-radius: 50%;

    animation: spin 1s linear infinite;
}

@keyframes spin {

    to {
        transform: rotate(360deg);
    }

}
```

---

# 90. QUICK REFERENCE: HTML TAGS

```text
STRUCTURE
<!DOCTYPE>
<html>
<head>
<body>
<title>
<meta>
<link>
<style>
<script>

TEXT
<h1> to <h6>
<p>
<br>
<hr>
<strong>
<b>
<em>
<i>
<u>
<mark>
<small>
<sub>
<sup>
<code>
<pre>
<blockquote>

CONTAINERS
<div>
<span>
<header>
<footer>
<nav>
<main>
<section>
<article>
<aside>

LINKS AND MEDIA
<a>
<img>
<audio>
<video>
<source>
<track>
<iframe>
<figure>
<figcaption>

LISTS
<ul>
<ol>
<li>
<dl>
<dt>
<dd>

TABLES
<table>
<thead>
<tbody>
<tfoot>
<tr>
<th>
<td>
<caption>
<col>
<colgroup>

FORMS
<form>
<input>
<textarea>
<select>
<option>
<optgroup>
<button>
<label>
<fieldset>
<legend>
<datalist>
<output>

OTHER
<canvas>
<svg>
<details>
<summary>
<dialog>
<template>
<time>
<progress>
<meter>
<address>
```

---

# 91. QUICK REFERENCE: CSS PROPERTIES

```text
TEXT
color
font-family
font-size
font-weight
font-style
text-align
text-decoration
text-transform
line-height
letter-spacing
word-spacing
text-shadow

BACKGROUND
background
background-color
background-image
background-size
background-position
background-repeat
background-attachment
background-clip
background-blend-mode

BORDERS
border
border-width
border-style
border-color
border-radius
outline
outline-offset

BOX MODEL
width
height
min-width
max-width
min-height
max-height
margin
padding
box-sizing

LAYOUT
display
position
top
right
bottom
left
z-index
float
clear
overflow
visibility
isolation

FLEXBOX
flex
flex-grow
flex-shrink
flex-basis
flex-direction
flex-wrap
flex-flow
justify-content
align-items
align-content
align-self
order
gap

GRID
grid
grid-template-columns
grid-template-rows
grid-template-areas
grid-column
grid-row
grid-area
grid-auto-flow
grid-auto-columns
grid-auto-rows
place-items
place-content
gap

EFFECTS
opacity
box-shadow
filter
backdrop-filter
clip-path
mask
transform
transform-origin
transition
animation

OTHER
cursor
pointer-events
user-select
object-fit
object-position
aspect-ratio
scroll-behavior
scroll-snap-type
scroll-snap-align
content-visibility
contain
```

---

# 92. QUICK REFERENCE: JAVASCRIPT SYNTAX

```text
VARIABLES
var
let
const

OUTPUT
console.log()
console.info()
console.warn()
console.error()
console.table()

DATA TYPES
String
Number
BigInt
Boolean
Undefined
Null
Symbol
Object

CONDITIONS
if
else
else if
switch
case
default
? :
??

LOOPS
for
while
do...while
for...of
for...in
break
continue

FUNCTIONS
function
return
=> 
async
await
yield

ARRAYS
push()
pop()
shift()
unshift()
splice()
slice()
map()
filter()
reduce()
forEach()
find()
some()
every()
sort()
flat()
flatMap()

OBJECTS
Object.keys()
Object.values()
Object.entries()
Object.assign()
Object.freeze()
Object.seal()
Object.hasOwn()

DOM
document
window
getElementById()
querySelector()
querySelectorAll()
createElement()
appendChild()
append()
remove()
replaceChildren()
classList
setAttribute()
getAttribute()
textContent
innerHTML

EVENTS
addEventListener()
removeEventListener()
preventDefault()
stopPropagation()

STORAGE
localStorage
sessionStorage
setItem()
getItem()
removeItem()
clear()

NETWORKING
fetch()
XMLHttpRequest
WebSocket

ASYNC
Promise
then()
catch()
finally()
Promise.all()
Promise.allSettled()
Promise.race()
Promise.any()

BROWSER APIS
navigator
location
history
clipboard
geolocation
Notification
IntersectionObserver
MutationObserver
ResizeObserver

ERROR HANDLING
try
catch
finally
throw

MODULES
import
export
export default

DEBUGGING
console.log()
console.table()
console.time()
console.assert()
debugger
```

---

# 93. FINAL LEARNING ROADMAP

## Stage 1: HTML foundations
Learn:
- Document structure
- Headings and paragraphs
- Links
- Images
- Lists
- Tables
- Forms
- Semantic elements

Goal: Build a complete static webpage.

## Stage 2: CSS foundations
Learn:
- Selectors
- Colours
- Typography
- Box model
- Display
- Flexbox
- Grid
- Positioning

Goal: Make your webpage look professionally designed.

## Stage 3: JavaScript foundations
Learn:
- Variables
- Data types
- Operators
- Conditions
- Loops
- Functions
- Arrays
- Objects

Goal: Create programs that perform calculations and process data.

## Stage 4: Interactive websites
Learn:
- DOM manipulation
- Event listeners
- Forms
- Local storage
- Timers
- Dynamic elements

Goal: Build interactive applications.

## Stage 5: Advanced web development
Learn:
- Fetch API
- Promises
- Async/await
- JavaScript modules
- Canvas
- WebSockets
- Browser APIs
- Web Components

Goal: Build sophisticated browser-based applications.

## Stage 6: Professional development
Learn:
- Responsive design
- Accessibility
- Security
- Testing
- Performance
- Version control
- Deployment
- Backend integration

Goal: Build and publish complete web applications.

---

# CONCLUSION

HTML, CSS and JavaScript form the foundation of modern web development.

HTML describes what exists.

CSS describes how it looks.

JavaScript describes what it does.

Once you understand how these three technologies work together, you can create everything from simple personal websites to interactive dashboards, games, browser-based software, simulations and complete web applications.

**End of Web Development Cheat Sheet.**/
`;
