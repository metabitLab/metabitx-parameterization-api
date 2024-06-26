import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { IMetric, setGlobalLogger, setGlobalMetric } from '@taibiex/smart-order-router';
import { MetricsLogger } from 'aws-embedded-metrics';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { default as bunyan, default as Logger } from 'bunyan';

import { AWSMetricsLogger, UniswapXParamServiceMetricDimension } from '../../entities';
import { BaseSwitchRepository } from '../../repositories/base';
import { SwitchRepository } from '../../repositories/switch-repository';
import { ApiInjector, ApiRInj } from '../base/api-handler';
import { SynthSwitchQueryParams } from './schema';

export interface ContainerInjected {
  dbInterface: BaseSwitchRepository;
}

export interface RequestInjected extends ApiRInj {
  _metric: IMetric;
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: string;
}

export class SwitchInjector extends ApiInjector<ContainerInjected, RequestInjected, void, SynthSwitchQueryParams> {
  public async buildContainerInjected(): Promise<ContainerInjected> {
    const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: {
        convertEmptyValues: true,
      },
      unmarshallOptions: {
        wrapNumbers: true,
      },
    });
    return {
      dbInterface: SwitchRepository.create(documentClient),
    };
  }

  public async getRequestInjected(
    _containerInjected: ContainerInjected,
    requestBody: void,
    requestQueryParams: SynthSwitchQueryParams,
    _event: APIGatewayProxyEvent,
    context: Context,
    log: Logger,
    metricsLogger: MetricsLogger
  ): Promise<RequestInjected> {
    const requestId = context.awsRequestId;

    log = log.child({
      serializers: bunyan.stdSerializers,
      requestBody,
      requestId,
    });
    setGlobalLogger(log);

    metricsLogger.setNamespace('Uniswap');
    metricsLogger.setDimensions(UniswapXParamServiceMetricDimension);
    const metric = new AWSMetricsLogger(metricsLogger);
    setGlobalMetric(metric);

    return {
      log,
      _metric: metric,
      requestId,
      tokenIn: requestQueryParams.tokenIn,
      tokenOut: requestQueryParams.tokenOut,
      tokenInChainId: requestQueryParams.tokenInChainId,
      tokenOutChainId: requestQueryParams.tokenOutChainId,
      amount: requestQueryParams.amount,
      type: requestQueryParams.type,
    };
  }
}
