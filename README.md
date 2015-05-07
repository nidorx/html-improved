# html-improved [![Build Status](https://travis-ci.org/nidorx/html-improved.svg?branch=master)](https://travis-ci.org/nidorx/html-improved) [![npm package](https://badge.fury.io/js/html-improved.svg)](https://www.npmjs.com/package/html-improved)

Html template engine, inspired by [jade](https://github.com/jadejs/jade)

Adds improvements to html templates

##Sample
[html-improved-sample](https://github.com/nidorx/html-improved-sample)


# Reference

## Includes

Includes allow you to insert the contents of one HTML file into another.

```html
<html>
    <head>
        ...
    </head>
    <body>
        <include file="./includes/sidebar.html" />
        <include file="./includes/footer.html" />
    </body>
</html>
```


###Including Plain Text

Including files that are not HTML (.html, .html, .xhtml, .xml) just includes the raw text.

```html
<html>
    <head>
        <include file="./style.css" />
    </head>
    <body>
        ...
    </body>
</html>
```

##Template inheritance

**Html Improved** supports template inheritance via the `<block/>` and `<extends/>` keywords.

A block is simply a "block" of HTML that may be replaced within a child template,
this process is recursive.

Html Improved blocks can provide default content if desired, however optional as
shown below by *block scripts*, *block content*, and *block foot*.


```html
<!-- layout.html -->
<html>
    <head>
        <block name="scripts">
            <script src="./jquery.js"></script>
        </block>
    </head>
    <body>
        <block name="content" />
        <div id="footer">
            <block name="footer">
                <p>some footer content</p>
            </block>
        </div>
    </body>
</html>
```

Now to extend the layout, simply create a new file and use the `<extends/>` tag as shown below,
giving the path (with the extension). You may now define one or more blocks that
 will override the parent block content, note that here the *foot* block is not
redefined and will output "some footer content".

```html
<!-- page-a.html -->
<extends file="./layout.html" />

<block name="scripts">
    <script src="./jquery.js"></script>
    <script src="./pets.js"></script>
</block>

<block name="content">
    <h1>title</h1>
</block>
```

It's also possible to override a block to provide additional blocks,
as shown in the following example where *content* now exposes a *sidebar* and *primary*
block for overriding, or the child template could override content all together.

```html
<!-- sub-layout.html -->
<extends file="./layout.html" />

<block name="content">
    <block name="sidebar">
        <div id="sidebar">
            <p>nothing</p>
        </div>
    </block>
    <div class="primary">
        <block name="primary">
            <p>nothing</p>
        </block>
    </div>
</block>
```

```html
<!-- page-b.html -->
<extends file="./sub-layout.html" />

<block name="sidebar">
    <ul>...</ul>
</block>
```

### Block append / prepend

**Html Improved** allows you to ***replace*** (default), ***prepend***, or ***append*** blocks.

Suppose for example you have default scripts in a "head" block that you wish to
utilize on every page, you might do this:

```html
<!-- layout.html -->
<html>
    <head>
        <block name="scripts">
            <script src="./jquery.js"></script>
        </block>
    </head>
    <body>
        ...
    </body>
</html>
```

Now suppose you have a page of your application for a JavaScript game, you want
some game related scripts as well as these defaults, you can simply append the block:

```html
<!-- page.html -->
<extends file="./layout.html" />

<block name="scripts" append>
    <script src="./vendor/three.js"></script>
    <script src="./game.js"></script>
</block>
```


## Variables

**Html Improved** makes it possible to define variables that can be used in your templates, using `<vars/>` tag.

```html
<vars
    pageTitle="On Dogs: Man's Best Friend"
    page-author="Alex"
/>

<html>
    <head>
        <title>#{pageTitle}</title>
    </head>
    <body>
        #{pageAuthor}
    </body>
</html>

<vars
    pageAuthor="Alex Rodin"
/>
```

note that **pageAuthor** and **page-author** forms define the same variable (pageAuthor).

Whenever you define a variable, all previous definitions of this variable will be overwritten.


### Conditional

**Html Improved** has syntax for conditional rendering of html blocks through tag `<if />`.

```html
<vars
    description="foo bar baz"
    authorised="false"
/>

<div id="user">
    <if cond="description">
        <h2>Description</h2>
        <p class="description">#{description}</p>
    </if>
    <if cond="!description">
        <h2>Description</h2>
        <p class="description">Has no description</p>
    </if>
    <if cond="authorised">
        <p>No content provided</p>
    </if>
</div>

<!-- will output -->
<div id="user">
    <h2>Description</h2>
    <p class="description">foo bar baz</p>
</div>
```


### String Escaped

To escape safely strings, just use the operator `#{` and `}`.

```html
<vars
    theGreat="<span>escape!</span>"
/>

<p>This will be safe: #{theGreat}</p>
```

will output

```html
<p>This will be safe: &lt;span&gt;escape!&lt;/span&gt;</p>
```


### String Unescaped

You don't have to play it safe. You can buffer unescaped values into your templates using `!{` and `}` operator.

```html
<vars
    riskyBusiness="<em>Some of the girls are wearing my mother's clothing.</em>"
/>
<div class="quote">
    <p>Joel: !{riskyBusiness}</p>
</div>
```

will output

```html
<div class="quote">
  <p>Joel: <em>Some of the girls are wearing my mother's clothing.</em></p>
</div>
```





## Mixins

Mixins allow you to create reusable blocks of HTML.

```html
<!-- Declaration -->
<mixin name="list">
    <ul>
        <li>foo</li>
        <li>bar</li>
        <li>baz</li>
    </ul>
</mixin>

<!-- Use -->
<list />

<!-- Will output -->
<ul>
    <li>foo</li>
    <li>bar</li>
    <li>baz</li>
</ul>
```

They can take required arguments:

```html
<!-- Declaration -->
<mixin name="pet" params="name">
    <li>#{name}</li>
</mixin>

<!-- Use -->
<ul>
    <pet name="cat"/>
    <pet name="dog"/>
    <pet name="pig"/>
</ul>


<!-- Will output -->
<ul>
    <li>cat</li>
    <li>dog</li>
    <li>pig</li>
</ul>
```

### Mixin content

Mixins can also take a block of HTML to act as the content:

```html
<!-- Declaration -->
<mixin name="article" params="title, authorName">
    <div class="article">
        <div class="article-wrapper">
            <h1>#{title}</h1>
            <span>#{authorName}</span>
            <if cond="$content">
                !{$content}
            </if>
            <if cond="!$content">
                <p>No content!</p>
            </if>
        </div>
    </div>
</mixin>

<!-- Use -->
<article title="Hello world" author-name="John Doe" />
<article title="Hello world" author-name="John Doe">
    <p>This is my</p>
    <p>Amazing article</p>
</article>


<!-- Will output -->
<div class="article">
    <div class="article-wrapper">
        <h1>Hello world</h1>
        <span>John Doe</span>
        <p>No content!</p>
    </div>
</div>
<div class="article">
    <div class="article-wrapper">
        <h1>Hello world</h1>
        <span>John Doe</span>
        <p>This is my</p>
        <p>Amazing article</p>
    </div>
</div>
```

### Mixin Attributes

Mixins also get an implicit attributes argument taken from the attributes passed to the mixin and variables.

```html
<!-- Declaration -->
<mixin name="link" params="href, name">
    <a class="#{klass}" href="#{basePath}/#{href}">#{name}</a>
</mixin>


<!-- Use -->
<link href="foo.html" name="bar" klass="btn"/>

<vars
    basePath="/my/base/path"
/>


<!-- Will output -->
<a href="/my/base/path/foo.html" class="btn">bar</a>
```