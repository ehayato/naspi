const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./constants');

// Create embed
class CustomEmbedBuilder {
  // default
  constructor() {
    this.embedData = {
      title: 'unset',
      desc: 'unset',
      color: COLORS.DEFAULT,
      fields: []
    };
  }

  // add field
  setTitle(title){
    this.embedData.title = title;
    return this;
  }
  setDes(desc){
    this.embedData.desc = desc;
    return this;
  }
  setColor(color){
    this.embedData.color = color;
    return this;
  }

  // make message
  build(){
    return new EmbedBuilder()
      .setTitle(this.embedData.title)
      .setDescription(this.embedData.desc)
      .setColor(this.embedData.color)
      .addFields(this.embedData.fields)
      .setTimestamp();
  }
}

module.exports = {
  CustomEmbedBuilder
};