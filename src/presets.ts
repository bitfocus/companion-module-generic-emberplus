import { CompanionPresetDefinitions, combineRgb } from '@companion-module/base'

export function GetPresetsList(): CompanionPresetDefinitions {
  const presets: CompanionPresetDefinitions = {}
  presets['take'] = {
    category: 'Actions\n(XY only)',
    name: 'Take',
    type: 'button',
    style: {
      text: 'Take',
      size: '18',
      color: combineRgb(255, 255, 255),
      bgcolor: combineRgb(0, 0, 0),
    },
    feedbacks: [
      {
        feedbackId: 'take',
        style: {
          bgcolor: combineRgb(255, 0, 0),
          color: combineRgb(255, 255, 255),
        },
        options: {},
      },
    ],
    steps: [
      {
        down: [
          {
            actionId: 'take',
            options: {},
          },
        ],
        up: [],
      },
    ],
  }

  presets['clear'] = {
    category: 'Actions\n(XY only)',
    name: 'Clear',
    type: 'button',
    style: {
      text: 'Clear',
      size: '18',
      color: combineRgb(128, 128, 128),
      bgcolor: combineRgb(0, 0, 0),
    },
    feedbacks: [
      {
        feedbackId: 'clear',
        style: {
          bgcolor: combineRgb(255, 255, 255),
          color: combineRgb(255, 0, 0),
        },
        options: {},
      },
    ],
    steps: [
      {
        down: [
          {
            actionId: 'clear',
            options: {},
          },
        ],
        up: [],
      },
    ],
  }
  return presets
}
