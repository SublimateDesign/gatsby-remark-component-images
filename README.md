# gatsby-remark-component-images

 A Gatsby remark plugin applying gatsby-plugin-sharp processing to html-style markdown tags. The results can then be converted into 

## Install

`npm install --save gatsby-remark-component-images`

OR

`yarn add gatsby-remark-component-images`

## How to use

This plugin expects relative image paths. The following configuration uses [gatsby-remark-relative-source](https://github.com/SublimateDesign/gatsby-remark-relative-source) to transform the image paths set by NetlifyCMS

```js
// gatsby-config.js
plugins: [
  // Add static assets before markdown files
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      path: `${__dirname}/static/uploads`,
      name: 'uploads',
    },
  },
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      path: `${__dirname}/src/pages`,
      name: 'pages',
    },
  },
  {
    resolve: `gatsby-transformer-remark`,
    options: {
      plugins: [
        // gatsby-remark-relative-source should be added before plugins needing relative sources
        {
          resolve: `gatsby-remark-relative-source`,
          options: {
            name: `uploads`,
            htmlSources: [{tagName: `post-video`, attributes: [`image`]}] // post-video is a component referenced later by gatsby-remark-custom-image-component
          },
        },
        {
          resolve: `gatsby-remark-images`,
          options: {
            // It's important to specify the maxWidth (in pixels) of
            // the content container as this plugin uses this as the
            // base for generating different widths of each image.
            maxWidth: 590,
          },
        },
        {
          resolve: `gatsby-remark-component-images`,
          options: {
            // plugin options
            components: [
              // source attributes can be defined in the array as strings or objects
              // string represenation maps to the source attribute and the target attribute defaults to the source attribute prefixed by the sharpMethod
              // so below becomes [{source: `image`, target: `fluidimage`}]
              {tagName: `post-video`, attributes: [`image`]},
              // object representation can be used to apply/override options or define the target attribute
              // object and string representation can be mixed to suit requirement
              {tagName: `gallery-media`, attributes: [{source: `src`, target: `fluidimg`, options: {tracedSVG: {color: "rgb(248, 255, 93)"},`widescreen`]}
            ],
            sharpMethod: 'fluid',
            // fluid's arguments
            quality: 50,
            maxWidth: 2500,
            withWebp: true
          }
        },
      ],
    },
  },
];
```

Source markdown:

```markdown
# src/pages/index.md
---
title: Hello World
---

<post-video url="https://vimeo.com/yourvideoid" image="/img/videoimage.png"></post-video>

<media-gallery displayclass="columns">
    <gallery-media displayclass="column is-one-third" src="/img/image1.png" widescreen="/img/widescreenimage1.png" title="Image 1"></gallery-media>
    <gallery-media displayclass="column is-one-third" src="/img/image2.png" widescreen="/img/widescreenimage2.png" title="Image 2"></gallery-media>
    <gallery-media displayclass="column is-one-third" src="/img/image3.png" widescreen="/img/widescreenimage3.png" title="Image 3"></gallery-media>
</media-gallery>

```

Component definitions in the template using rehype-react:

```js
//src/components/Content
import React from 'react'
import rehypeReact from 'rehype-react'
import PostVideo from './PostVideo'
import MediaGallery from './MediaGallery'
//...

const renderAst = new rehypeReact({
  createElement: React.createElement,
  components: { "post-video": PostVideo, "media-gallery": MediaGallery }
}).Compiler

export const HtmlComponentContent = ({content, className}) => (
  <div className={className}>{renderAst(content)}</div>
)

```

Parsing results in the components:

```js
//src/components/PostVideo
import React from 'react'
//...

const PostVideo = ({url, image, fluidimage}) => {
    const responsiveImage = JSON.parse(fluidimage)
    //...
}
```

```js
//src/components/MediaGallery
import React from 'react'
import Img from 'gatsby-image'
//...

const MediaGallery = ({children, displayclass}) => {
    let allMedia = []
    if (children && children.length) {
        children.filter(child => child !== '\n' && child.props && child.type === 'gallery-media' && child.props.fluidimg).map(child => {
            let sources = [JSON.parse(child.props.fluidmobile)]
            if (child.props.fluidwidescreen) {
                sources.push({...(JSON.parse(child.propsfluidwidescreen)), media: `(min-width: 1500px)`})
            }
            allMedia.push({sources: sources, title: child.props.title, displayclass: child.props.displayclass)
        })
    }
    return (
        <div className={displayclass}>
            {allMedia.map(media => 
                <div className={media.displayclass}>
                    <Img fluid={media.sources} display></Img>
                </div>
            )}            
        </div>
    )
    //...
}
```