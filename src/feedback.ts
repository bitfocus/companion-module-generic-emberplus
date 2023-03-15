import {
  CompanionFeedbackDefinition,
  CompanionFeedbackDefinitions,
  combineRgb,
  InstanceBase,
} from '@companion-module/base'
import { EmberClient } from 'emberplus-connection'
import { EmberPlusConfig } from './config'

export enum FeedbackId {
  SourceBackgroundSelected = 'sourceBackgroundSelected',
  TargetBackgroundSelected = 'targetBackgroundSelected',
}

export function GetFeedbacksList(
  _self: InstanceBase<EmberPlusConfig>,
  _emberClient: EmberClient,
  config: EmberPlusConfig
): CompanionFeedbackDefinitions {
  const feedbacks: { [id in FeedbackId]: CompanionFeedbackDefinition | undefined } = {
    [FeedbackId.SourceBackgroundSelected]: {
      name: 'Source Background If Selected',
      description: 'Change Background of Source, when it is currently selected.',
      type: 'boolean',
      defaultStyle: {
        // The default style change for a boolean feedback
        // The user will be able to customise these values as well as the fields that will be changed
        bgcolor: combineRgb(255, 0, 0),
        color: combineRgb(0, 0, 0),
      },
      options: [
        {
          type: 'number',
          label: 'Select Matrix Number',
          id: 'matrix',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
        {
          type: 'number',
          label: 'Value',
          id: 'source',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
      ],
      callback: (feedback) => {
        return config.selectedSource[Number(feedback.options['matrix'])] == feedback.options['source']
      },
    },
    [FeedbackId.TargetBackgroundSelected]: {
      name: 'Target Background if Selected',
      description: 'Change Background of Target, when it is currently selected.',
      type: 'boolean',
      defaultStyle: {
        // The default style change for a boolean feedback
        // The user will be able to customise these values as well as the fields that will be changed
        bgcolor: combineRgb(255, 0, 0),
        color: combineRgb(0, 0, 0),
      },
      options: [
        {
          type: 'number',
          label: 'Select Matrix Number',
          id: 'matrix',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
        {
          type: 'number',
          label: 'Value',
          id: 'target',
          required: true,
          min: -0,
          max: 0xffffffff,
          default: 0,
        },
      ],
      callback: (feedback) => {
        return config.selectedDestination[Number(feedback.options['matrix'])] == feedback.options['target']
      },
    },
  }

  return feedbacks
}
